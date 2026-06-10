import { db, withSchoolContext } from "../db";
import { StudentRepository } from "../repositories/student.repository";
import { EnrolmentRepository } from "../repositories/enrolment.repository";
import { ClassRepository } from "../repositories/class.repository";
import { AcademicYearRepository } from "../repositories/academic-year.repository";
import { StorageService } from "./storage.service";

const studentRepo = new StudentRepository();
const enrolmentRepo = new EnrolmentRepository();
const classRepo = new ClassRepository();
const academicYearRepo = new AcademicYearRepository();
const storageService = new StorageService();

export interface EnrolStudentInput {
  emisNumber?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: Date;
  gender: string;
  photoUrl?: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;
  guardianRelationship: string;
  homeAddress: string;
  previousSchool?: string;
}

export class StudentService {
  /**
   * Enrols a new student. Checks class capacity boundaries first.
   */
  async enrolStudent(
    schoolId: string,
    studentInput: EnrolStudentInput,
    classId: string,
    academicYearId: string
  ) {
    return withSchoolContext(schoolId, async (tx) => {
      // 1. Check target class details & capacity
      const targetClass = await classRepo.findById(classId, tx);
      if (!targetClass) {
        throw new Error("Class not found");
      }

      // Verify that this class belongs to the school
      if (targetClass.schoolId !== schoolId) {
        throw new Error("Target class does not belong to this school tenant");
      }

      // Check capacity by querying the current class roster count directly
      const currentRoster = await studentRepo.list(schoolId, { classId, academicYearId }, tx);
      if (currentRoster.length >= targetClass.capacity) {
        throw new Error(`Target class capacity exceeded. Limit is ${targetClass.capacity} students.`);
      }

      // 2. Create the student
      const student = await studentRepo.create({
        schoolId,
        ...studentInput,
      }, tx);

      // 3. Create the enrolment link
      const enrolment = await enrolmentRepo.create({
        schoolId,
        studentId: student.id,
        classId,
        academicYearId,
        status: "active",
      }, tx);

      return { student, enrolment };
    });
  }

  /**
   * Lists students with search & filters.
   */
  async listStudents(
    schoolId: string,
    filters: { classId?: string; academicYearId?: string; search?: string }
  ) {
    return withSchoolContext(schoolId, async (tx) => {
      // If academicYearId is missing, default to current academic year
      let currentYearId = filters.academicYearId;
      if (!currentYearId) {
        const currentYear = await academicYearRepo.findCurrent(schoolId, tx);
        currentYearId = currentYear?.id;
      }

      return studentRepo.list(schoolId, {
        classId: filters.classId,
        academicYearId: currentYearId,
        search: filters.search,
      }, tx);
    });
  }

  /**
   * Fetches full profile details including current class placement.
   */
  async getStudentProfile(studentId: string, schoolId: string) {
    return withSchoolContext(schoolId, async (tx) => {
      const student = await studentRepo.findById(studentId, tx);
      if (!student) {
        throw new Error("Student profile not found");
      }

      const activePlacement = await enrolmentRepo.findActiveByStudent(studentId, schoolId, tx);

      return {
        student,
        placement: activePlacement || null,
      };
    });
  }

  /**
   * Updates student personal profile attributes.
   */
  async updateStudent(studentId: string, schoolId: string, input: Partial<EnrolStudentInput>) {
    return withSchoolContext(schoolId, async (tx) => {
      const student = await studentRepo.findById(studentId, tx);
      if (!student) {
        throw new Error("Student not found");
      }
      return studentRepo.update(studentId, input, tx);
    });
  }

  /**
   * Uploads and stores student profile photo.
   */
  async updateStudentPhoto(
    studentId: string,
    schoolId: string,
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ) {
    return withSchoolContext(schoolId, async (tx) => {
      const student = await studentRepo.findById(studentId, tx);
      if (!student) {
        throw new Error("Student not found");
      }

      // Upload file to active container
      const photoUrl = await storageService.uploadFile(fileBuffer, fileName, mimeType);

      // Save URL path
      await studentRepo.update(studentId, { photoUrl }, tx);

      return { photoUrl };
    });
  }

  /**
   * Transfers a student to a different class stream.
   */
  async transferStudent(studentId: string, schoolId: string, newClassId: string, academicYearId: string) {
    return withSchoolContext(schoolId, async (tx) => {
      // 1. Get active enrolment
      const activePlacement = await enrolmentRepo.findActiveByStudent(studentId, schoolId, tx);
      if (!activePlacement) {
        throw new Error("Student does not have an active placement to transfer from. Enrol them instead.");
      }

      // Check destination capacity
      const targetClass = await classRepo.findById(newClassId, tx);
      if (!targetClass) {
        throw new Error("Destination class not found");
      }

      const currentRoster = await studentRepo.list(schoolId, { classId: newClassId, academicYearId }, tx);
      if (currentRoster.length >= targetClass.capacity) {
        throw new Error(`Destination class capacity exceeded. Limit is ${targetClass.capacity} students.`);
      }

      // 2. Perform transfer
      const newEnrolment = await enrolmentRepo.transfer(
        studentId,
        schoolId,
        activePlacement.enrolment.id,
        newClassId,
        academicYearId,
        tx
      );

      return newEnrolment;
    });
  }
}
