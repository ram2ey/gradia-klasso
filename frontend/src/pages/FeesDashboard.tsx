import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../services/api";
import axiosInstance from "../services/axiosInstance";
import {
  Coins,
  CreditCard,
  Search,
  Filter,
  Plus,
  ArrowRight,
  Download,
  Loader2,
  CheckCircle,
  AlertTriangle,
  User,
  Settings,
  X,
  FileSpreadsheet,
  AlertCircle
} from "lucide-react";

interface AcademicYear {
  id: string;
  label: string;
  isCurrent: boolean;
}

interface ClassItem {
  id: string;
  name: string;
  level: number;
}

interface FeeStructure {
  id: string;
  label: string;
  amount: string;
  term: number;
  classLevel: number;
  dueDate: string;
}

interface ArrearItem {
  id: string;
  firstName: string;
  lastName: string;
  emisNumber: string | null;
  className: string | null;
  totalDue: number;
  totalPaid: number;
  balance: number;
}

interface CollectionItem {
  id: string;
  amount: string;
  paymentMethod: "momo" | "cash" | "bank";
  momoNetwork: string | null;
  receiptNumber: string;
  status: "pending" | "success" | "failed";
  paidAt: string | null;
  studentFirstName: string;
  studentLastName: string;
  studentEmisNumber: string | null;
  className: string | null;
  recorderName: string | null;
}

interface StudentSearchItem {
  id: string;
  firstName: string;
  lastName: string;
  emisNumber: string | null;
  className: string | null;
}

interface StudentFeeAssignmentDetail {
  id: string;
  amountDue: number;
  amountPaid: number;
  outstanding: number;
  term: number;
  label: string;
  dueDate: string;
}

interface StudentPaymentHistoryDetail {
  id: string;
  amount: string;
  paymentMethod: string;
  momoNetwork: string | null;
  momoPhone: string | null;
  hubtelReference: string | null;
  status: string;
  receiptNumber: string;
  paidAt: string | null;
  feeAssignmentId: string;
}

interface StudentFeeDetails {
  assignments: StudentFeeAssignmentDetail[];
  paymentHistory: StudentPaymentHistoryDetail[];
  totalDue: number;
  totalPaid: number;
  totalOutstanding: number;
}

export const FeesDashboard: React.FC = () => {
  const { user } = useAuth();
  
  // Navigation & Role contexts
  const isHeadteacher = user?.role === "headteacher";
  const isBursar = user?.role === "bursar";
  const canConfigure = isHeadteacher;
  const canRecordCash = isBursar;
  const canViewAdminReports = isHeadteacher || isBursar;
  
  const [activeTab, setActiveTab] = useState<"billing" | "arrears" | "collections" | "settings">(
    canViewAdminReports ? "billing" : "billing"
  );

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // General State
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loadingGeneral, setLoadingGeneral] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Tab 1: Dashboard Metrics
  const [metrics, setMetrics] = useState({ expected: 0, collected: 0, outstanding: 0 });
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Tab 2: Billing & Student Search
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudentSearchItem[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentSearchItem | null>(null);
  const [selectedStudentFees, setSelectedStudentFees] = useState<StudentFeeDetails | null>(null);
  const [loadingStudentFees, setLoadingStudentFees] = useState(false);

  // Tab 3: Arrears List
  const [arrears, setArrears] = useState<ArrearItem[]>([]);
  const [loadingArrears, setLoadingArrears] = useState(false);

  // Tab 4: Collections Log
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [filterClass, setFilterClass] = useState("");
  const [filterTerm, setFilterTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Tab 5: Settings (Structures & Configurations)
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [loadingStructures, setLoadingStructures] = useState(false);

  // Modals & Actions
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentType, setPaymentType] = useState<"cash" | "momo">("cash");
  const [selectedAssignment, setSelectedAssignment] = useState<StudentFeeAssignmentDetail | null>(null);

  // Form states
  const [newStructure, setNewStructure] = useState({
    academicYearId: "",
    term: 1,
    classLevel: 1,
    label: "",
    amount: "",
    dueDate: "",
  });
  const [assignForm, setAssignForm] = useState({
    feeStructureId: "",
    classId: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    momoPhone: "",
    momoNetwork: "mtn" as "mtn" | "telecel" | "airteltigo",
  });
  const [savingAction, setSavingAction] = useState(false);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

  // Initialize dropdowns and default data
  useEffect(() => {
    const initData = async () => {
      setLoadingGeneral(true);
      setError(null);

      // Fetch Academic Years & Classes
      const [yearsRes, classesRes] = await Promise.all([
        apiRequest<AcademicYear[]>("/fees/academic-years"),
        apiRequest<ClassItem[]>("/classes"),
      ]);

      if (yearsRes.success && yearsRes.data) {
        setAcademicYears(yearsRes.data);
        const currentYear = yearsRes.data.find(y => y.isCurrent) || yearsRes.data[0];
        if (currentYear) {
          setNewStructure(prev => ({ ...prev, academicYearId: currentYear.id }));
        }
      }
      if (classesRes.success && classesRes.data) {
        setClasses(classesRes.data);
      }

      setLoadingGeneral(false);
      
      // Load default active tab context
      if (canViewAdminReports) {
        fetchMetrics();
      }
    };

    initData();
  }, []);

  if (loadingGeneral) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="animate-spin h-8 w-8 text-primary-500" />
          <p className="text-sm text-slate-400">Loading billing context...</p>
        </div>
      </div>
    );
  }

  // Fetch metrics
  const fetchMetrics = async () => {
    setLoadingMetrics(true);
    const res = await apiRequest("/fees/dashboard");
    setLoadingMetrics(false);
    if (res.success && res.data) {
      setMetrics(res.data);
    }
  };

  // Search Students
  const handleStudentSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentSearchQuery.trim()) return;
    setSearchingStudents(true);
    setError(null);
    setSelectedStudent(null);
    setSelectedStudentFees(null);

    const res = await apiRequest<StudentSearchItem[]>(`/students?search=${encodeURIComponent(studentSearchQuery)}`);
    setSearchingStudents(false);

    if (res.success && res.data) {
      setSearchResults(res.data);
      if (res.data.length === 0) {
        setError("No students matched your search query.");
      }
    } else {
      setError(res.error || "Failed to lookup students.");
    }
  };

  // Select Student & Load Fees
  const handleSelectStudent = async (student: StudentSearchItem) => {
    setSelectedStudent(student);
    setSearchResults([]);
    setStudentSearchQuery("");
    setLoadingStudentFees(true);
    setError(null);

    const res = await apiRequest<StudentFeeDetails>(`/fees/student/${student.id}`);
    setLoadingStudentFees(false);

    if (res.success && res.data) {
      setSelectedStudentFees(res.data);
    } else {
      setError(res.error || "Failed to load fee ledger for student.");
    }
  };

  // Fetch Arrears Listing
  const fetchArrears = async () => {
    setLoadingArrears(true);
    setError(null);
    const res = await apiRequest<ArrearItem[]>("/fees/arrears");
    setLoadingArrears(false);
    if (res.success && res.data) {
      setArrears(res.data);
    } else {
      setError(res.error || "Failed to load arrears debtor list.");
    }
  };

  // Fetch Collections Logs
  const fetchCollections = async () => {
    setLoadingCollections(true);
    setError(null);
    const query = new URLSearchParams();
    if (filterClass) query.append("classId", filterClass);
    if (filterTerm) query.append("term", filterTerm);
    if (filterStatus) query.append("status", filterStatus);

    const res = await apiRequest<CollectionItem[]>(`/fees/collections?${query.toString()}`);
    setLoadingCollections(false);
    if (res.success && res.data) {
      setCollections(res.data);
    } else {
      setError(res.error || "Failed to load collections records.");
    }
  };

  // Fetch Fee Structures Configurations
  const fetchStructures = async () => {
    setLoadingStructures(true);
    setError(null);
    const res = await apiRequest<FeeStructure[]>("/fees/structures");
    setLoadingStructures(false);
    if (res.success && res.data) {
      setStructures(res.data);
    } else {
      setError(res.error || "Failed to load structures configuration.");
    }
  };

  // Run tab specific fetches
  useEffect(() => {
    if (activeTab === "arrears" && canViewAdminReports) {
      fetchArrears();
    } else if (activeTab === "collections" && canViewAdminReports) {
      fetchCollections();
    } else if (activeTab === "settings" && canConfigure) {
      fetchStructures();
    }
  }, [activeTab, filterClass, filterTerm, filterStatus]);

  // Open Payment modal
  const handleOpenPayment = (assignment: StudentFeeAssignmentDetail, type: "cash" | "momo") => {
    if (type === "cash" && !canRecordCash) {
      setError("Only Bursars can record cash payments directly.");
      return;
    }
    setSelectedAssignment(assignment);
    setPaymentType(type);
    setPaymentForm({
      amount: String(assignment.outstanding),
      momoPhone: "",
      momoNetwork: "mtn",
    });
    setError(null);
    setSuccess(null);
    setShowPaymentModal(true);
  };

  // Submit payment handler
  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !selectedAssignment) return;
    setSavingAction(true);
    setError(null);
    setSuccess(null);

    const amountNum = parseFloat(paymentForm.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Payment amount must be a positive number.");
      setSavingAction(false);
      return;
    }

    if (amountNum > selectedAssignment.outstanding) {
      setError(`Payment amount exceeds the outstanding balance of GHS ${selectedAssignment.outstanding}`);
      setSavingAction(false);
      return;
    }

    let res;
    if (paymentType === "cash") {
      res = await apiRequest("/fees/pay/cash", {
        method: "POST",
        body: {
          studentId: selectedStudent.id,
          feeAssignmentId: selectedAssignment.id,
          amount: amountNum,
        },
      });
    } else {
      if (!paymentForm.momoPhone.match(/^\d{10}$/)) {
        setError("Mobile Money Phone must be exactly 10 digits.");
        setSavingAction(false);
        return;
      }
      res = await apiRequest("/fees/pay/momo", {
        method: "POST",
        body: {
          studentId: selectedStudent.id,
          feeAssignmentId: selectedAssignment.id,
          amount: amountNum,
          phone: paymentForm.momoPhone,
          network: paymentForm.momoNetwork,
        },
      });
    }

    setSavingAction(false);

    if (res.success) {
      setSuccess(
        paymentType === "cash"
          ? "Cash receipt logged successfully! SMS receipt dispatched to parent."
          : `Mobile money checkpoint prompt triggered: ${res.data?.message || "Verify payment authorization on client device."}`
      );
      setShowPaymentModal(false);
      // Refresh current student profile fees ledger
      handleSelectStudent(selectedStudent);
      if (canViewAdminReports) {
        fetchMetrics();
      }
    } else {
      setError(res.error || "Payment recording failed.");
    }
  };

  // Create structure handler
  const handleCreateStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAction(true);
    setError(null);
    setSuccess(null);

    const amountNum = parseFloat(newStructure.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Fee structure amount must be a positive number.");
      setSavingAction(false);
      return;
    }

    const res = await apiRequest("/fees/structures", {
      method: "POST",
      body: {
        ...newStructure,
        amount: amountNum,
      },
    });

    setSavingAction(false);

    if (res.success) {
      setSuccess("Fee structure template defined successfully!");
      setShowStructureModal(false);
      setNewStructure({
        academicYearId: academicYears.find(y => y.isCurrent)?.id || "",
        term: 1,
        classLevel: 1,
        label: "",
        amount: "",
        dueDate: "",
      });
      fetchStructures();
    } else {
      setError(res.error || "Failed to create fee structure template.");
    }
  };

  // Assign fee structure class-wide handler
  const handleAssignFeeClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAction(true);
    setError(null);
    setSuccess(null);

    const res = await apiRequest("/fees/assign-class", {
      method: "POST",
      body: assignForm,
    });

    setSavingAction(false);

    if (res.success) {
      setSuccess(`Fee successfully assigned! ${res.data?.message || ""}`);
      setShowAssignModal(false);
      setAssignForm({
        feeStructureId: "",
        classId: "",
      });
      if (canViewAdminReports) {
        fetchMetrics();
      }
    } else {
      setError(res.error || "Failed to batch assign fees.");
    }
  };

  // Receipt PDF downloading function
  const handleDownloadReceipt = async (paymentId: string, receiptNo: string) => {
    setDownloadingReceiptId(paymentId);
    setError(null);
    try {
      const response = await axiosInstance.get(`/fees/receipt/${paymentId}`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `receipt_${receiptNo}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccess(`Receipt PDF ${receiptNo} downloaded successfully.`);
    } catch (err: any) {
      console.error("[Download Receipt Error]", err);
      setError("Failed to compile or download receipt PDF. Ensure server is active.");
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  // Export collections report to CSV
  const handleExportCSV = () => {
    if (collections.length === 0) {
      setError("No collections data available to export. Adjust filters.");
      return;
    }

    const headers = [
      "Receipt Number",
      "Student",
      "EMIS Number",
      "Class",
      "Amount (GHS)",
      "Method",
      "Network",
      "Status",
      "Date Paid",
      "Recorded By",
    ];

    const rows = collections.map(col => [
      col.receiptNumber,
      `"${col.studentFirstName} ${col.studentLastName}"`,
      col.studentEmisNumber || "N/A",
      col.className || "N/A",
      parseFloat(col.amount).toFixed(2),
      col.paymentMethod.toUpperCase(),
      col.momoNetwork || "N/A",
      col.status.toUpperCase(),
      col.paidAt ? new Date(col.paidAt).toLocaleDateString("en-GB") : "N/A",
      col.recorderName || "System",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `fee_collections_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setSuccess("Collections log exported successfully as CSV.");
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto text-slate-100">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center">
            <Coins className="mr-3 h-8 w-8 text-primary-400" />
            Bursary & Billing Center
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Track student billing transactions, log bursary receipt records, and reconcile mobile checkout logs.
          </p>
        </div>

        {canConfigure && (
          <div className="flex space-x-3">
            <button
              onClick={() => setShowStructureModal(true)}
              className="inline-flex items-center space-x-2 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 text-slate-200 font-semibold py-2.5 px-4 rounded-xl transition-all cursor-pointer text-xs"
            >
              <Settings className="h-4 w-4 text-slate-400" />
              <span>Define Fee Structure</span>
            </button>
            <button
              onClick={() => setShowAssignModal(true)}
              className="inline-flex items-center space-x-2 bg-gradient-to-r from-primary-500 to-sky-600 hover:from-primary-600 hover:to-sky-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer text-xs shadow-md shadow-primary-500/10"
            >
              <Plus className="h-4 w-4" />
              <span>Assign Class Fees</span>
            </button>
          </div>
        )}
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-2xl flex items-center justify-between text-sm animate-fadeIn">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 p-4 rounded-2xl flex items-center justify-between text-sm animate-fadeIn">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Summary Metrics (For headteacher / bursar) */}
      {(() => {
        if (!canViewAdminReports) return null;
        const percentage = metrics.expected > 0 ? (metrics.collected / metrics.expected) * 100 : 0;
        const hue = Math.min(120, Math.max(0, (percentage / 100) * 120)); // Map 0-100% to Red (0) through Green (120)
        const collectionColor = `hsl(${hue}, 80%, 50%)`;
        const circumference = 2 * Math.PI * 26; // Radius 26 -> circumference ~163.36

        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute right-3 top-3 bg-slate-850 p-2.5 rounded-lg border border-slate-800">
                <Coins className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Expected Invoicing</p>
              {loadingMetrics ? (
                <Loader2 className="animate-spin h-6 w-6 text-primary-400 mt-2" />
              ) : (
                <p className="text-2xl font-black text-white mt-1">GHS {metrics.expected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              )}
              <p className="text-[10px] text-slate-400 mt-1">Total assigned student obligations for year</p>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Collections</p>
                {loadingMetrics ? (
                  <Loader2 className="animate-spin h-6 w-6 text-emerald-400 mt-2" />
                ) : (
                  <p className="text-2xl font-black text-emerald-400 mt-1">GHS {metrics.collected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                )}
                <p className="text-[10px] text-emerald-500/80 mt-1 truncate">
                  Collected: {percentage.toFixed(1)}% aggregate
                </p>
              </div>
              <div className="relative flex items-center justify-center h-16 w-16 shrink-0 select-none">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                  <circle
                    cx="32"
                    cy="32"
                    r="26"
                    className="stroke-slate-800"
                    strokeWidth="5"
                    fill="transparent"
                  />
                  {!loadingMetrics && (
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      stroke={collectionColor}
                      strokeWidth="5"
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference - (percentage / 100) * circumference}
                      className="transition-all duration-1000 ease-out animate-pulse"
                      strokeLinecap="round"
                      style={{ filter: `drop-shadow(0 0 3px ${collectionColor})` }}
                    />
                  )}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs font-extrabold text-white leading-none">{percentage.toFixed(0)}%</span>
                  <span className="text-[7px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Paid</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute right-3 top-3 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Outstanding Arrears</p>
              {loadingMetrics ? (
                <Loader2 className="animate-spin h-6 w-6 text-red-400 mt-2" />
              ) : (
                <p className="text-2xl font-black text-red-400 mt-1">GHS {metrics.outstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              )}
              <p className="text-[10px] text-red-400/80 mt-1">Total outstanding bills currently due</p>
            </div>
          </div>
        );
      })()}

      {/* Tab Control */}
      <div className="flex border-b border-slate-850">
        <button
          onClick={() => setActiveTab("billing")}
          className={`px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === "billing" ? "border-primary-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Student Fee Ledger
        </button>

        {canViewAdminReports && (
          <>
            <button
              onClick={() => setActiveTab("arrears")}
              className={`px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === "arrears" ? "border-primary-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Defaulters (Arrears)
            </button>
            <button
              onClick={() => setActiveTab("collections")}
              className={`px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === "collections" ? "border-primary-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              Collections Report Log
            </button>
          </>
        )}

        {canConfigure && (
          <button
            onClick={() => setActiveTab("settings")}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === "settings" ? "border-primary-500 text-white" : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Fees Templates
          </button>
        )}
      </div>

      {/* TAB 1: Billing Ledger Search & Action */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          
          {/* Lookup Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-white text-base">Select Student Ledger Context</h3>
            <form onSubmit={handleStudentSearch} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
              <input
                type="text"
                value={studentSearchQuery}
                onChange={e => setStudentSearchQuery(e.target.value)}
                placeholder="Search students by name or EMIS number to inspect balances..."
                className="w-full bg-slate-950/50 border border-slate-850 rounded-xl py-3 pl-11 pr-24 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
              <button
                type="submit"
                disabled={searchingStudents}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-slate-800 hover:bg-slate-750 text-white text-xs font-semibold px-4 py-2 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
              >
                {searchingStudents ? <Loader2 className="animate-spin h-3.5 w-3.5" /> : "Lookup"}
              </button>
            </form>

            {/* Student Search Results Dropdown List */}
            {searchResults.length > 0 && (
              <div className="border border-slate-800 rounded-xl bg-slate-950/90 p-2 divide-y divide-slate-900 max-h-60 overflow-y-auto">
                {searchResults.map(std => (
                  <button
                    key={std.id}
                    onClick={() => handleSelectStudent(std)}
                    className="w-full text-left p-3 hover:bg-slate-905 flex items-center justify-between text-sm rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="h-8 w-8 bg-slate-800 rounded-full flex items-center justify-center font-bold text-xs text-slate-400">
                        {std.firstName[0]}
                        {std.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-white">{std.firstName} {std.lastName}</p>
                        <p className="text-xs text-slate-500 font-mono">{std.emisNumber || "No EMIS Number"}</p>
                      </div>
                    </div>
                    <span className="bg-slate-900 text-slate-400 px-3 py-1 rounded-full text-xs font-medium border border-slate-800">
                      {std.className || "Unassigned"}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Student Billing Detail Section */}
          {loadingStudentFees ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="animate-spin h-8 w-8 text-primary-500" />
            </div>
          ) : selectedStudent && selectedStudentFees ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
              
              {/* Profile Card & Aggregates */}
              <div className="space-y-6 lg:col-span-1">
                <div className="bg-slate-900 border border-slate-850 rounded-2xl p-5 text-center space-y-4">
                  <div className="h-16 w-16 bg-gradient-to-tr from-primary-400 to-sky-600 rounded-2xl mx-auto flex items-center justify-center font-bold text-xl text-slate-950 shadow-md">
                    {selectedStudent.firstName[0]}
                    {selectedStudent.lastName[0]}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-lg">{selectedStudent.firstName} {selectedStudent.lastName}</h3>
                    <p className="text-xs font-semibold text-slate-400">{selectedStudent.className || "Not Placed"}</p>
                    <p className="text-xs font-mono text-slate-500 mt-1">EMIS: {selectedStudent.emisNumber || "N/A"}</p>
                  </div>
                  
                  <div className="h-px bg-slate-800" />

                  <div className="space-y-2 text-left text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Billed:</span>
                      <span className="font-semibold text-slate-300">GHS {selectedStudentFees.totalDue.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Paid:</span>
                      <span className="font-semibold text-emerald-400">GHS {selectedStudentFees.totalPaid.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-850 pt-2 font-bold text-base">
                      <span className="text-slate-400">Balance Due:</span>
                      <span className={selectedStudentFees.totalOutstanding > 0 ? "text-red-400" : "text-emerald-400"}>
                        GHS {selectedStudentFees.totalOutstanding.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Assignments & Payments Ledger */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Active Billings / Assignments */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h4 className="font-bold text-white text-base">Active Fee Obligations</h4>
                  {selectedStudentFees.assignments.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">No fee assignments configured for this student.</p>
                  ) : (
                    <div className="divide-y divide-slate-850">
                      {selectedStudentFees.assignments.map(assign => (
                        <div key={assign.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="space-y-1">
                            <p className="font-bold text-white text-sm">{assign.label}</p>
                            <div className="flex items-center space-x-3 text-xs text-slate-500">
                              <span>Term: {assign.term}</span>
                              <span>•</span>
                              <span>Due: {new Date(assign.dueDate).toLocaleDateString("en-GB")}</span>
                            </div>
                            <div className="flex space-x-4 pt-1 text-xs text-slate-400">
                              <span>Due: GHS {assign.amountDue.toFixed(2)}</span>
                              <span>Paid: GHS {assign.amountPaid.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2.5">
                            {assign.outstanding > 0 ? (
                              <>
                                <button
                                  onClick={() => handleOpenPayment(assign, "momo")}
                                  disabled={!isOnline}
                                  className="inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  title={!isOnline ? "Requires active network connection" : "Pay via Mobile Money"}
                                >
                                  <CreditCard className="h-3.5 w-3.5 mr-1" />
                                  <span>Pay MoMo</span>
                                </button>
                                {canRecordCash && (
                                  <button
                                    onClick={() => handleOpenPayment(assign, "cash")}
                                    disabled={!isOnline}
                                    className="inline-flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={!isOnline ? "Requires active network connection" : "Record Cash Payment"}
                                  >
                                    <Coins className="h-3.5 w-3.5 mr-1" />
                                    <span>Record Cash</span>
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold">
                                Fully Settled
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payments History Ledger */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h4 className="font-bold text-white text-base">Payment & Receipt Ledger</h4>
                  {selectedStudentFees.paymentHistory.length === 0 ? (
                    <p className="text-sm text-slate-500 py-4 text-center">No payment transactions recorded.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase">
                            <th className="pb-3">Receipt No</th>
                            <th className="pb-3">Method</th>
                            <th className="pb-3">Amount</th>
                            <th className="pb-3">Status</th>
                            <th className="pb-3">Date</th>
                            <th className="pb-3 text-right">PDF</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {selectedStudentFees.paymentHistory.map(pay => (
                            <tr key={pay.id} className="text-slate-300">
                              <td className="py-3 font-mono font-semibold">{pay.receiptNumber}</td>
                              <td className="py-3 uppercase">
                                {pay.paymentMethod === "momo" ? `${pay.paymentMethod} (${pay.momoNetwork})` : pay.paymentMethod}
                              </td>
                              <td className="py-3 font-semibold">GHS {parseFloat(pay.amount).toFixed(2)}</td>
                              <td className="py-3">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    pay.status === "success"
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : pay.status === "pending"
                                      ? "bg-yellow-500/10 text-yellow-400"
                                      : "bg-red-500/10 text-red-400"
                                  }`}
                                >
                                  {pay.status}
                                </span>
                              </td>
                              <td className="py-3">
                                {pay.paidAt ? new Date(pay.paidAt).toLocaleDateString("en-GB") : "-"}
                              </td>
                              <td className="py-3 text-right">
                                {pay.status === "success" ? (
                                  <button
                                    onClick={() => handleDownloadReceipt(pay.id, pay.receiptNumber)}
                                    disabled={downloadingReceiptId === pay.id}
                                    className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-lg cursor-pointer disabled:opacity-50"
                                    title="Download PDF Receipt"
                                  >
                                    {downloadingReceiptId === pay.id ? (
                                      <Loader2 className="animate-spin h-3.5 w-3.5" />
                                    ) : (
                                      <Download className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-slate-900/10 border border-slate-800 border-dashed rounded-2xl p-16 text-center text-slate-500 space-y-2">
              <User className="h-8 w-8 text-slate-600 mx-auto" />
              <p className="font-semibold text-sm">Select a student profile to inspect transaction ledgers.</p>
              <p className="text-xs text-slate-600">Enter a first name, last name, or EMIS code using the search bar above.</p>
            </div>
          )}

        </div>
      )}

      {/* TAB 2: Arrears Defaulters List */}
      {activeTab === "arrears" && canViewAdminReports && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-bold text-white text-base">Defaulters List (Outstanding Balances)</h3>
              <p className="text-xs text-slate-500">List of active students with outstanding fee debt, sorted by balance owed.</p>
            </div>
          </div>

          {loadingArrears ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="animate-spin h-8 w-8 text-primary-500" />
            </div>
          ) : arrears.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">No students are currently in arrears! All invoices settled.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase">
                    <th className="pb-3">Student</th>
                    <th className="pb-3">Class</th>
                    <th className="pb-3">EMIS Number</th>
                    <th className="pb-3">Total Invoiced</th>
                    <th className="pb-3">Total Paid</th>
                    <th className="pb-3">Outstanding Arrears</th>
                    <th className="pb-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {arrears.map(arr => (
                    <tr key={arr.id} className="text-slate-300">
                      <td className="py-3 font-semibold text-white">{arr.firstName} {arr.lastName}</td>
                      <td className="py-3">{arr.className || "Not Placed"}</td>
                      <td className="py-3 font-mono">{arr.emisNumber || "N/A"}</td>
                      <td className="py-3">GHS {arr.totalDue.toFixed(2)}</td>
                      <td className="py-3 text-emerald-400">GHS {arr.totalPaid.toFixed(2)}</td>
                      <td className="py-3 text-red-400 font-bold">GHS {arr.balance.toFixed(2)}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedStudent({
                              id: arr.id,
                              firstName: arr.firstName,
                              lastName: arr.lastName,
                              emisNumber: arr.emisNumber,
                              className: arr.className,
                            });
                            handleSelectStudent({
                              id: arr.id,
                              firstName: arr.firstName,
                              lastName: arr.lastName,
                              emisNumber: arr.emisNumber,
                              className: arr.className,
                            });
                            setActiveTab("billing");
                          }}
                          className="text-primary-400 hover:text-white text-xs font-semibold flex items-center justify-end"
                        >
                          <span>Manage Ledger</span>
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Collections Report Logs */}
      {activeTab === "collections" && canViewAdminReports && (
        <div className="space-y-6 animate-fadeIn">
          
          {/* Filters Bar */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row items-center justify-between gap-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center space-x-2">
                <Filter className="h-4.5 w-4.5 text-slate-500 shrink-0" />
                <select
                  value={filterClass}
                  onChange={e => setFilterClass(e.target.value)}
                  className="bg-slate-950/60 border border-slate-850 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all cursor-pointer"
                >
                  <option value="">All Classes</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>

              <select
                value={filterTerm}
                onChange={e => setFilterTerm(e.target.value)}
                className="bg-slate-950/60 border border-slate-850 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all cursor-pointer"
              >
                <option value="">All Terms</option>
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
              </select>

              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-slate-950/60 border border-slate-850 rounded-xl py-2 px-3 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="success">Success</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 px-4 rounded-xl transition-all cursor-pointer text-xs w-full md:w-auto justify-center"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export CSV Ledger</span>
            </button>
          </div>

          {/* Collections Grid Listing */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-white text-base">Collections Transaction History</h3>

            {loadingCollections ? (
              <div className="py-20 flex justify-center">
                <Loader2 className="animate-spin h-8 w-8 text-primary-500" />
              </div>
            ) : collections.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-10">No payment collections matched the filters.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase">
                      <th className="pb-3">Receipt No</th>
                      <th className="pb-3">Student</th>
                      <th className="pb-3">Class</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Method</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Date Paid</th>
                      <th className="pb-3">Recorded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {collections.map(col => (
                      <tr key={col.id} className="text-slate-300">
                        <td className="py-3 font-mono font-semibold">{col.receiptNumber}</td>
                        <td className="py-3 font-semibold text-white">{col.studentFirstName} {col.studentLastName}</td>
                        <td className="py-3">{col.className || "N/A"}</td>
                        <td className="py-3 font-bold">GHS {parseFloat(col.amount).toFixed(2)}</td>
                        <td className="py-3 uppercase">{col.paymentMethod === "momo" ? `momo (${col.momoNetwork})` : col.paymentMethod}</td>
                        <td className="py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              col.status === "success"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : col.status === "pending"
                                ? "bg-yellow-500/10 text-yellow-400"
                                : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {col.status}
                          </span>
                        </td>
                        <td className="py-3">
                          {col.paidAt ? new Date(col.paidAt).toLocaleDateString("en-GB") : "-"}
                        </td>
                        <td className="py-3 text-slate-400">{col.recorderName || "System / Webhook"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* TAB 4: Fee Structure Templates (Settings) */}
      {activeTab === "settings" && canConfigure && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="font-bold text-white text-base">Defined School Fee Templates</h3>
            <p className="text-xs text-slate-500">Configure core school fees requirements for academic terms and levels.</p>
          </div>

          {loadingStructures ? (
            <div className="py-20 flex justify-center">
              <Loader2 className="animate-spin h-8 w-8 text-primary-500" />
            </div>
          ) : structures.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-10">No fee structures defined. Click "Define Fee Structure" to configure.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase">
                    <th className="pb-3">Label</th>
                    <th className="pb-3">Class Level</th>
                    <th className="pb-3">Term</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {structures.map(struct => (
                    <tr key={struct.id} className="text-slate-300">
                      <td className="py-3 font-semibold text-white">{struct.label}</td>
                      <td className="py-3">Basic {struct.classLevel}</td>
                      <td className="py-3">Term {struct.term}</td>
                      <td className="py-3 font-semibold">GHS {parseFloat(struct.amount).toFixed(2)}</td>
                      <td className="py-3">{new Date(struct.dueDate).toLocaleDateString("en-GB")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Define Fee Structure */}
      {showStructureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-6 relative animate-zoomIn">
            <button
              onClick={() => setShowStructureModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h3 className="font-extrabold text-white text-lg">Define Fee Structure</h3>
              <p className="text-xs text-slate-500">Define expected costs assigned to classrooms.</p>
            </div>

            <form onSubmit={handleCreateStructure} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-semibold">Academic Year</label>
                <select
                  value={newStructure.academicYearId}
                  onChange={e => setNewStructure(prev => ({ ...prev, academicYearId: e.target.value }))}
                  required
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
                >
                  <option value="">Select Year...</option>
                  {academicYears.map(y => (
                    <option key={y.id} value={y.id}>{y.label} {y.isCurrent ? "(Current)" : ""}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Term</label>
                  <select
                    value={newStructure.term}
                    onChange={e => setNewStructure(prev => ({ ...prev, term: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
                  >
                    <option value="1">Term 1</option>
                    <option value="2">Term 2</option>
                    <option value="3">Term 3</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Class Level</label>
                  <select
                    value={newStructure.classLevel}
                    onChange={e => setNewStructure(prev => ({ ...prev, classLevel: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => (
                      <option key={lvl} value={lvl}>Basic {lvl} {lvl > 6 ? "(JHS)" : "(Primary)"}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-semibold">Label Description</label>
                <input
                  type="text"
                  placeholder="e.g. Basic 1-3 Term 3 Tuition Fee"
                  value={newStructure.label}
                  onChange={e => setNewStructure(prev => ({ ...prev, label: e.target.value }))}
                  required
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Amount (GHS)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="350.00"
                    value={newStructure.amount}
                    onChange={e => setNewStructure(prev => ({ ...prev, amount: e.target.value }))}
                    required
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-semibold">Due Date</label>
                  <input
                    type="date"
                    value={newStructure.dueDate}
                    onChange={e => setNewStructure(prev => ({ ...prev, dueDate: e.target.value }))}
                    required
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer animate-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingAction}
                className="w-full inline-flex items-center justify-center bg-gradient-to-r from-primary-500 to-sky-600 hover:from-primary-600 hover:to-sky-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all cursor-pointer disabled:opacity-50 mt-2 text-xs"
              >
                {savingAction ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Settings className="h-4 w-4 mr-2" />}
                <span>Define Structure</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Assign Fee Class-Wide */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-6 relative animate-zoomIn">
            <button
              onClick={() => setShowAssignModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h3 className="font-extrabold text-white text-lg">Assign Fees Class-Wide</h3>
              <p className="text-xs text-slate-500">Log fee obligations batch-wise for active classroom enrollments.</p>
            </div>

            <form onSubmit={handleAssignFeeClass} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-semibold">Select Fee Template</label>
                <select
                  value={assignForm.feeStructureId}
                  onChange={e => setAssignForm(prev => ({ ...prev, feeStructureId: e.target.value }))}
                  required
                  onClick={() => {
                    if (structures.length === 0) fetchStructures();
                  }}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
                >
                  <option value="">Select Template...</option>
                  {structures.map(st => (
                    <option key={st.id} value={st.id}>{st.label} (GHS {parseFloat(st.amount).toFixed(2)})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-semibold">Destination Class Stream</label>
                <select
                  value={assignForm.classId}
                  onChange={e => setAssignForm(prev => ({ ...prev, classId: e.target.value }))}
                  required
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
                >
                  <option value="">Select Class...</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={savingAction}
                className="w-full inline-flex items-center justify-center bg-gradient-to-r from-primary-500 to-sky-600 hover:from-primary-600 hover:to-sky-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all cursor-pointer disabled:opacity-50 mt-2 text-xs"
              >
                {savingAction ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                <span>Batch Assign Fees</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Record Payment (Cash or MoMo Checkout) */}
      {showPaymentModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-6 relative animate-zoomIn">
            <button
              onClick={() => setShowPaymentModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <h3 className="font-extrabold text-white text-lg">
                {paymentType === "cash" ? "Record Cash Settlement" : "Mobile Money Prompt Checkout"}
              </h3>
              <p className="text-xs text-slate-500">
                Fee Assignment: <span className="font-semibold text-slate-300">{selectedAssignment.label}</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Deficit Balance: <span className="font-bold text-red-400">GHS {selectedAssignment.outstanding.toFixed(2)}</span>
              </p>
            </div>

            <form onSubmit={handleProcessPayment} className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-semibold">Payment Amount (GHS)</label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedAssignment.outstanding}
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                  required
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-1 focus:ring-primary-500 font-semibold"
                />
              </div>

              {paymentType === "momo" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-semibold">Mobile Money Network</label>
                    <select
                      value={paymentForm.momoNetwork}
                      onChange={e => setPaymentForm(prev => ({ ...prev, momoNetwork: e.target.value as any }))}
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
                    >
                      <option value="mtn">MTN Mobile Money</option>
                      <option value="telecel">Telecel Cash</option>
                      <option value="airteltigo">AirtelTigo Money</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-slate-400 font-semibold">MoMo Phone Number (10 digits)</label>
                    <input
                      type="text"
                      placeholder="e.g. 0244123456"
                      maxLength={10}
                      value={paymentForm.momoPhone}
                      onChange={e => setPaymentForm(prev => ({ ...prev, momoPhone: e.target.value }))}
                      required
                      className="w-full bg-slate-950 border border-slate-850 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={savingAction}
                className="w-full inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl transition-all cursor-pointer disabled:opacity-50 mt-2 text-xs"
              >
                {savingAction ? (
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                ) : paymentType === "cash" ? (
                  <Coins className="h-4 w-4 mr-2" />
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                <span>
                  {paymentType === "cash" ? "Log Cash Settlement" : "Trigger USSD Prompt Checkout"}
                </span>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default FeesDashboard;
