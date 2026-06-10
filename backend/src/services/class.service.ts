import { withSchoolContext } from "../db";
import { ClassRepository, CreateClassInput } from "../repositories/class.repository";
import { AcademicYearRepository } from "../repositories/academic-year.repository";

const classRepo = new ClassRepository();
const academicYearRepo = new AcademicYearRepository();

export class ClassService {
  /**
   * Helper: fetches the current academic year, creating a default one if none exists.
   */
  private async getOrInitializeCurrentYear(schoolId: string, tx: any) {
    let year = await academicYearRepo.findCurrent(schoolId, tx);
    if (!year) {
      // Create a default academic year for immediate operational use
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 10); // 10 months long

      year = await academicYearRepo.create({
        schoolId,
        label: `${startDate.getFullYear()}/${startDate.getFullYear() + 1}`,
        startDate,
        endDate,
        isCurrent: true,
      }, tx);
    }
    return year;
  }

  /**
   * Create a new class stream (e.g. Basic 3B). Restricted to headteachers.
   */
  async createClass(schoolId: string, name: string, level: number, classTeacherId?: string) {
    return withSchoolContext(schoolId, async (tx) => {
      const activeYear = await this.getOrInitializeCurrentYear(schoolId, tx);
      
      const newClass = await classRepo.create({
        schoolId,
        name,
        level,
        academicYearId: activeYear.id,
        classTeacherId: classTeacherId || null,
        capacity: 40, // default
      }, tx);

      return newClass;
    });
  }

  /**
   * Lists classes for the academic year. Defaults to current active year.
   */
  async listClasses(schoolId: string, academicYearId?: string) {
    return withSchoolContext(schoolId, async (tx) => {
      let targetYearId = academicYearId;
      if (!targetYearId) {
        const currentYear = await this.getOrInitializeCurrentYear(schoolId, tx);
        targetYearId = currentYear.id;
      }
      return classRepo.listByAcademicYear(schoolId, targetYearId, tx);
    });
  }
}
