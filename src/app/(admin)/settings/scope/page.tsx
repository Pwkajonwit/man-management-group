'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Layers3, Plus, Trash2 } from 'lucide-react';
import LinearLoadingScreen from '@/components/LinearLoadingScreen';
import { useAppContext } from '@/contexts/AppContext';
import { useConfirmModal } from '@/contexts/ConfirmModalContext';
import { subscribeScopeCatalog, upsertScopeCatalog } from '@/lib/firestore';
import { DEFAULT_BRANCH_ID, DEFAULT_DEPARTMENT_ID } from '@/lib/scope';
import { ScopeBranch, ScopeDepartment } from '@/types/construction';

function normalizeId(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '-');
}

function sortById<T extends { id: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

export default function ScopeSettingsPage() {
    const { loading, dataSource } = useAppContext();
    const modal = useConfirmModal();

    const [branches, setBranches] = useState<ScopeBranch[]>([]);
    const [departments, setDepartments] = useState<ScopeDepartment[]>([]);
    const [isCatalogLoading, setIsCatalogLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const [branchIdInput, setBranchIdInput] = useState('');
    const [branchLabelInput, setBranchLabelInput] = useState('');
    const [departmentIdInput, setDepartmentIdInput] = useState('');
    const [departmentLabelInput, setDepartmentLabelInput] = useState('');
    const [departmentBranchIdInput, setDepartmentBranchIdInput] = useState('');

    useEffect(() => {
        if (dataSource !== 'firebase') {
            setBranches([{ id: DEFAULT_BRANCH_ID, label: 'สำนักงานใหญ่' }]);
            setDepartments([{ id: DEFAULT_DEPARTMENT_ID, label: 'ทั่วไป', branchId: DEFAULT_BRANCH_ID }]);
            setIsCatalogLoading(false);
            return;
        }

        const unsubscribe = subscribeScopeCatalog((catalog) => {
            setBranches(sortById(catalog.branches));
            setDepartments(sortById(catalog.departments));
            setIsCatalogLoading(false);
        });

        return () => unsubscribe();
    }, [dataSource]);

    useEffect(() => {
        if (!departmentBranchIdInput && branches.length > 0) {
            setDepartmentBranchIdInput(branches[0].id);
            return;
        }

        if (departmentBranchIdInput && !branches.some((branch) => branch.id === departmentBranchIdInput)) {
            setDepartmentBranchIdInput(branches[0]?.id || '');
        }
    }, [branches, departmentBranchIdInput]);

    const canAddDepartment = useMemo(() => branches.length > 0, [branches.length]);

    const persistCatalog = async (nextBranches: ScopeBranch[], nextDepartments: ScopeDepartment[]) => {
        const sortedBranches = sortById(nextBranches);
        const sortedDepartments = sortById(nextDepartments);
        setBranches(sortedBranches);
        setDepartments(sortedDepartments);

        if (dataSource !== 'firebase') return;

        try {
            setIsSaving(true);
            await upsertScopeCatalog({
                branches: sortedBranches,
                departments: sortedDepartments,
            });
        } catch (error) {
            console.error('Failed to update scope catalog:', error);
            void modal.error('บันทึกข้อมูลสาขา/แผนกไม่สำเร็จ โปรดลองอีกครั้ง');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddBranch = async () => {
        const id = normalizeId(branchIdInput);
        const label = branchLabelInput.trim();

        if (!id) {
            void modal.warning('กรุณาระบุ Branch ID');
            return;
        }
        if (branches.some((branch) => branch.id === id)) {
            void modal.warning('Branch ID นี้มีอยู่แล้ว');
            return;
        }

        await persistCatalog(
            [...branches, { id, ...(label ? { label } : {}) }],
            departments
        );
        setBranchIdInput('');
        setBranchLabelInput('');
        if (!departmentBranchIdInput) setDepartmentBranchIdInput(id);
    };

    const handleDeleteBranch = async (branchId: string) => {
        const linkedDepartments = departments.filter((department) => department.branchId === branchId);
        const confirmed = await modal.confirm({
            title: 'ยืนยันการลบสาขา',
            message: `ลบสาขา "${branchId}" หรือไม่?`,
            description: linkedDepartments.length > 0
                ? `ระบบจะลบแผนกที่ผูกกับสาขานี้อีก ${linkedDepartments.length} รายการ`
                : undefined,
            confirmLabel: 'ลบ',
        });
        if (!confirmed) return;

        await persistCatalog(
            branches.filter((branch) => branch.id !== branchId),
            departments.filter((department) => department.branchId !== branchId)
        );
    };

    const handleAddDepartment = async () => {
        const id = normalizeId(departmentIdInput);
        const label = departmentLabelInput.trim();
        const branchId = normalizeId(departmentBranchIdInput);

        if (!canAddDepartment) {
            void modal.warning('กรุณาเพิ่มสาขาก่อนเพิ่มแผนก');
            return;
        }
        if (!id) {
            void modal.warning('กรุณาระบุ Department ID');
            return;
        }
        if (!branchId || !branches.some((branch) => branch.id === branchId)) {
            void modal.warning('กรุณาเลือกสาขาที่ถูกต้อง');
            return;
        }
        if (departments.some((department) => department.id === id)) {
            void modal.warning('Department ID นี้มีอยู่แล้ว');
            return;
        }

        await persistCatalog(
            branches,
            [...departments, { id, ...(label ? { label } : {}), branchId }]
        );
        setDepartmentIdInput('');
        setDepartmentLabelInput('');
    };

    const handleDeleteDepartment = async (departmentId: string) => {
        const confirmed = await modal.confirm({
            title: 'ยืนยันการลบแผนก',
            message: `ลบแผนก "${departmentId}" หรือไม่?`,
            confirmLabel: 'ลบ',
        });
        if (!confirmed) return;

        await persistCatalog(
            branches,
            departments.filter((department) => department.id !== departmentId)
        );
    };

    if (loading || isCatalogLoading) {
        return <LinearLoadingScreen message="กำลังโหลดข้อมูลสาขา/แผนก..." />;
    }

    return (
        <div className="min-h-full bg-[#f5f6f8] p-4 sm:p-6 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-5">
                <header className="rounded-2xl border border-[#d0d4e4] bg-white p-5 sm:p-6">
                    <h1 className="text-[24px] font-bold text-[#323338]">ตั้งค่าสาขาและแผนก</h1>
                    <p className="text-[13px] text-[#676879] mt-1">
                        เพิ่ม/ลบตัวเลือกสำหรับ Scope (Branch/Department) ที่แสดงในเมนูด้านซ้าย
                    </p>
                    {dataSource !== 'firebase' && (
                        <p className="text-[12px] text-[#ad6800] mt-2">
                            โหมด Local: ข้อมูลจะไม่ถูกบันทึกถาวร
                        </p>
                    )}
                </header>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <section className="rounded-2xl border border-[#d0d4e4] bg-white p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Building2 className="w-5 h-5 text-[#0073ea]" />
                            <h2 className="text-[18px] font-semibold text-[#323338]">สาขา (Branch)</h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 mb-4">
                            <input
                                value={branchIdInput}
                                onChange={(e) => setBranchIdInput(e.target.value)}
                                placeholder="branch-id เช่น branch-bkk"
                                className="w-full rounded-lg border border-[#d0d4e4] px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                            />
                            <input
                                value={branchLabelInput}
                                onChange={(e) => setBranchLabelInput(e.target.value)}
                                placeholder="ชื่อสาขา (ไม่บังคับ)"
                                className="w-full rounded-lg border border-[#d0d4e4] px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#0073ea]"
                            />
                            <button
                                type="button"
                                onClick={() => void handleAddBranch()}
                                disabled={isSaving}
                                className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#0073ea] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#0060c0] disabled:bg-[#c1c7d0]"
                            >
                                <Plus className="w-4 h-4" />
                                เพิ่ม
                            </button>
                        </div>

                        <div className="rounded-xl border border-[#e6e9ef] overflow-hidden">
                            {branches.length === 0 ? (
                                <div className="px-4 py-8 text-center text-[13px] text-[#676879]">ยังไม่มีสาขา</div>
                            ) : (
                                branches.map((branch) => (
                                    <div key={branch.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b last:border-b-0 border-[#e6e9ef]">
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-semibold text-[#323338] truncate">{branch.label || branch.id}</p>
                                            <p className="text-[11px] text-[#676879] truncate">{branch.id}</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void handleDeleteBranch(branch.id)}
                                            disabled={isSaving}
                                            className="inline-flex items-center gap-1 rounded-md border border-[#f4c7ce] bg-[#ffeff2] px-2 py-1 text-[12px] font-semibold text-[#b4233a] hover:bg-[#ffe1e7] disabled:opacity-60"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            ลบ
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>

                    <section className="rounded-2xl border border-[#d0d4e4] bg-white p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <Layers3 className="w-5 h-5 text-[#00a66a]" />
                            <h2 className="text-[18px] font-semibold text-[#323338]">แผนก (Department)</h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
                            <input
                                value={departmentIdInput}
                                onChange={(e) => setDepartmentIdInput(e.target.value)}
                                placeholder="dept-id เช่น dept-finance"
                                className="w-full rounded-lg border border-[#d0d4e4] px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#00a66a]"
                            />
                            <input
                                value={departmentLabelInput}
                                onChange={(e) => setDepartmentLabelInput(e.target.value)}
                                placeholder="ชื่อแผนก (ไม่บังคับ)"
                                className="w-full rounded-lg border border-[#d0d4e4] px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#00a66a]"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 mb-4">
                            <select
                                value={departmentBranchIdInput}
                                onChange={(e) => setDepartmentBranchIdInput(e.target.value)}
                                disabled={!canAddDepartment}
                                className="w-full rounded-lg border border-[#d0d4e4] px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-[#00a66a] disabled:bg-[#f5f6f8]"
                            >
                                {canAddDepartment ? (
                                    branches.map((branch) => (
                                        <option key={branch.id} value={branch.id}>
                                            {(branch.label || branch.id)} ({branch.id})
                                        </option>
                                    ))
                                ) : (
                                    <option value="">กรุณาเพิ่มสาขาก่อน</option>
                                )}
                            </select>
                            <button
                                type="button"
                                onClick={() => void handleAddDepartment()}
                                disabled={isSaving || !canAddDepartment}
                                className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#00a66a] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#008a59] disabled:bg-[#c1c7d0]"
                            >
                                <Plus className="w-4 h-4" />
                                เพิ่ม
                            </button>
                        </div>

                        <div className="rounded-xl border border-[#e6e9ef] overflow-hidden">
                            {departments.length === 0 ? (
                                <div className="px-4 py-8 text-center text-[13px] text-[#676879]">ยังไม่มีแผนก</div>
                            ) : (
                                departments.map((department) => (
                                    <div key={department.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b last:border-b-0 border-[#e6e9ef]">
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-semibold text-[#323338] truncate">{department.label || department.id}</p>
                                            <p className="text-[11px] text-[#676879] truncate">
                                                {department.id} • {department.branchId || '-'}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void handleDeleteDepartment(department.id)}
                                            disabled={isSaving}
                                            className="inline-flex items-center gap-1 rounded-md border border-[#f4c7ce] bg-[#ffeff2] px-2 py-1 text-[12px] font-semibold text-[#b4233a] hover:bg-[#ffe1e7] disabled:opacity-60"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            ลบ
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
