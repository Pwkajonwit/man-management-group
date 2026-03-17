'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Layers3, Plus, Save, Settings2, Trash2 } from 'lucide-react';
import LinearLoadingScreen from '@/components/LinearLoadingScreen';
import { useAppContext } from '@/contexts/AppContext';
import { useConfirmModal } from '@/contexts/ConfirmModalContext';
import { subscribeScopeCatalog, upsertScopeCatalog } from '@/lib/firestore';
import { ScopeBranch, ScopeDepartment } from '@/types/construction';

function normalizeId(value: string): string {
    return value.trim().toLowerCase().replace(/\s+/g, '-');
}

function sortById<T extends { id: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function getScopeLabel(label: string | undefined, id: string): string {
    const trimmed = label?.trim();
    return trimmed || id;
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
            setBranches([]);
            setDepartments([]);
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
    const departmentCountByBranchId = useMemo(() => {
        const counts = new Map<string, number>();
        departments.forEach((department) => {
            const branchKey = department.branchId || '';
            if (!branchKey) return;
            counts.set(branchKey, (counts.get(branchKey) || 0) + 1);
        });
        return counts;
    }, [departments]);

    const branchLabelById = useMemo(() => {
        const map = new Map<string, string>();
        branches.forEach((branch) => {
            map.set(branch.id, getScopeLabel(branch.label, branch.id));
        });
        return map;
    }, [branches]);

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
            void modal.error('บันทึกข้อมูลสาขาและแผนกไม่สำเร็จ โปรดลองอีกครั้ง');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddBranch = async () => {
        const id = normalizeId(branchIdInput);
        const label = branchLabelInput.trim();

        if (!id) {
            void modal.warning('กรุณาระบุรหัสสาขา');
            return;
        }
        if (branches.some((branch) => branch.id === id)) {
            void modal.warning('รหัสสาขานี้มีอยู่แล้ว');
            return;
        }

        await persistCatalog([...branches, { id, ...(label ? { label } : {}) }], departments);
        setBranchIdInput('');
        setBranchLabelInput('');
        if (!departmentBranchIdInput) setDepartmentBranchIdInput(id);
    };

    const handleDeleteBranch = async (branchId: string) => {
        const linkedDepartments = departments.filter((department) => department.branchId === branchId);
        const confirmed = await modal.confirm({
            title: 'ยืนยันการลบสาขา',
            message: `ลบสาขา "${getScopeLabel(branches.find((branch) => branch.id === branchId)?.label, branchId)}" หรือไม่?`,
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
            void modal.warning('กรุณาระบุรหัสแผนก');
            return;
        }
        if (!branchId || !branches.some((branch) => branch.id === branchId)) {
            void modal.warning('กรุณาเลือกสาขาที่ถูกต้อง');
            return;
        }
        if (departments.some((department) => department.id === id)) {
            void modal.warning('รหัสแผนกนี้มีอยู่แล้ว');
            return;
        }

        await persistCatalog(branches, [...departments, { id, ...(label ? { label } : {}), branchId }]);
        setDepartmentIdInput('');
        setDepartmentLabelInput('');
    };

    const handleDeleteDepartment = async (departmentId: string) => {
        const confirmed = await modal.confirm({
            title: 'ยืนยันการลบแผนก',
            message: `ลบแผนก "${getScopeLabel(departments.find((department) => department.id === departmentId)?.label, departmentId)}" หรือไม่?`,
            confirmLabel: 'ลบ',
        });
        if (!confirmed) return;

        await persistCatalog(branches, departments.filter((department) => department.id !== departmentId));
    };

    if (loading || isCatalogLoading) {
        return <LinearLoadingScreen message="กำลังโหลดข้อมูลสาขาและแผนก..." />;
    }

    return (
        <div className="flex-1 flex flex-col min-w-0 bg-[#f5f6f8]">
            <header className="min-h-[64px] bg-white flex items-center px-4 sm:px-6 lg:px-8 py-3 border-b border-[#d0d4e4] gap-4 shrink-0 transition-all">
                <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-[#323338] truncate flex items-center gap-2">
                    <Layers3 className="w-7 h-7 text-[#0073ea]" />
                    ตั้งค่าสาขาและแผนก
                </h1>
            </header>

            <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
                <div className="max-w-[1500px] grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <div className="xl:col-span-2 space-y-4">
                        <div className="bg-white border border-[#d0d4e4] rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-[15px] font-semibold text-[#323338]">
                                <Settings2 className="w-4 h-4 text-[#0073ea]" />
                                ภาพรวมการตั้งค่า Scope
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <div className="rounded-lg border border-[#d0d4e4] px-3 py-3 bg-white">
                                    <div className="text-[12px] text-[#676879]">จำนวนสาขา</div>
                                    <div className="mt-1 text-[22px] font-bold text-[#323338]">{branches.length}</div>
                                </div>
                                <div className="rounded-lg border border-[#d0d4e4] px-3 py-3 bg-white">
                                    <div className="text-[12px] text-[#676879]">จำนวนแผนก</div>
                                    <div className="mt-1 text-[22px] font-bold text-[#323338]">{departments.length}</div>
                                </div>
                                <div className="rounded-lg border border-[#d0d4e4] px-3 py-3 bg-white">
                                    <div className="text-[12px] text-[#676879]">สถานะการบันทึก</div>
                                    <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#f5f6f8] px-3 py-1 text-[12px] font-semibold text-[#323338]">
                                        {isSaving ? <Save className="w-3.5 h-3.5 text-[#0073ea]" /> : <CheckCircle2 className="w-3.5 h-3.5 text-[#00a66a]" />}
                                        {isSaving ? 'กำลังบันทึก' : 'พร้อมใช้งาน'}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white border border-[#d0d4e4] rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-[15px] font-semibold text-[#323338]">
                                <Building2 className="w-4 h-4 text-[#0073ea]" />
                                จัดการสาขา
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                <input
                                    value={branchIdInput}
                                    onChange={(event) => setBranchIdInput(event.target.value)}
                                    placeholder="รหัสสาขา เช่น branch-bkk"
                                    className="h-10 px-3 border border-[#d0d4e4] rounded-lg text-[14px] outline-none focus:ring-2 focus:ring-[#0073ea] bg-white"
                                />
                                <input
                                    value={branchLabelInput}
                                    onChange={(event) => setBranchLabelInput(event.target.value)}
                                    placeholder="ชื่อสาขา (ไม่บังคับ)"
                                    className="h-10 px-3 border border-[#d0d4e4] rounded-lg text-[14px] outline-none focus:ring-2 focus:ring-[#0073ea] bg-white"
                                />
                                <button
                                    type="button"
                                    onClick={() => void handleAddBranch()}
                                    disabled={isSaving}
                                    className="h-10 px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0073ea] text-white text-[13px] font-medium hover:bg-[#0060c0] disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <Plus className="w-4 h-4" />
                                    เพิ่มสาขา
                                </button>
                            </div>
                            <div className="space-y-2">
                                {branches.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-[#d0d4e4] px-4 py-8 text-center text-[13px] text-[#676879]">
                                        ยังไม่มีสาขาในระบบ
                                    </div>
                                ) : (
                                    branches.map((branch) => (
                                        <div key={branch.id} className="rounded-lg border border-[#e6e9ef] px-4 py-3 flex items-center justify-between gap-3 bg-white">
                                            <div className="min-w-0">
                                                <div className="text-[13px] font-semibold text-[#323338] truncate">{getScopeLabel(branch.label, branch.id)}</div>
                                                <div className="text-[11px] text-[#676879] mt-0.5">{branch.id} • {departmentCountByBranchId.get(branch.id) || 0} แผนก</div>
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
                        </div>

                        <div className="bg-white border border-[#d0d4e4] rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2 text-[15px] font-semibold text-[#323338]">
                                <Layers3 className="w-4 h-4 text-[#0073ea]" />
                                จัดการแผนก
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <input
                                    value={departmentIdInput}
                                    onChange={(event) => setDepartmentIdInput(event.target.value)}
                                    placeholder="รหัสแผนก เช่น dept-finance"
                                    className="h-10 px-3 border border-[#d0d4e4] rounded-lg text-[14px] outline-none focus:ring-2 focus:ring-[#0073ea] bg-white"
                                />
                                <input
                                    value={departmentLabelInput}
                                    onChange={(event) => setDepartmentLabelInput(event.target.value)}
                                    placeholder="ชื่อแผนก (ไม่บังคับ)"
                                    className="h-10 px-3 border border-[#d0d4e4] rounded-lg text-[14px] outline-none focus:ring-2 focus:ring-[#0073ea] bg-white"
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                                <select
                                    value={departmentBranchIdInput}
                                    onChange={(event) => setDepartmentBranchIdInput(event.target.value)}
                                    disabled={!canAddDepartment}
                                    className="h-10 px-3 border border-[#d0d4e4] rounded-lg text-[14px] outline-none focus:ring-2 focus:ring-[#0073ea] bg-white disabled:opacity-60"
                                >
                                    {canAddDepartment ? (
                                        branches.map((branch) => (
                                            <option key={branch.id} value={branch.id}>
                                                {getScopeLabel(branch.label, branch.id)}
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
                                    className="h-10 px-4 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0073ea] text-white text-[13px] font-medium hover:bg-[#0060c0] disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <Plus className="w-4 h-4" />
                                    เพิ่มแผนก
                                </button>
                            </div>
                            <div className="space-y-2">
                                {departments.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-[#d0d4e4] px-4 py-8 text-center text-[13px] text-[#676879]">
                                        ยังไม่มีแผนกในระบบ
                                    </div>
                                ) : (
                                    departments.map((department) => (
                                        <div key={department.id} className="rounded-lg border border-[#e6e9ef] px-4 py-3 flex items-center justify-between gap-3 bg-white">
                                            <div className="min-w-0">
                                                <div className="text-[13px] font-semibold text-[#323338] truncate">{getScopeLabel(department.label, department.id)}</div>
                                                <div className="text-[11px] text-[#676879] mt-0.5">
                                                    {department.id} • {branchLabelById.get(department.branchId || '') || department.branchId || '-'}
                                                </div>
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
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-white border border-[#d0d4e4] rounded-xl p-4 space-y-3 sticky top-0">
                            <div className="text-[15px] font-semibold text-[#323338]">สรุปรายการในระบบ</div>
                            <div className="rounded-lg border border-[#e6e9ef] bg-[#f8fbff] px-3 py-2 text-[12px] text-[#516273]">
                                การตั้งค่านี้จะถูกใช้เป็นตัวเลือกกลางใน sidebar, ผู้ใช้, โครงการ และงาน
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center">
                                <div className="rounded-lg border border-[#e6e9ef] p-3">
                                    <div className="text-[10px] text-[#676879]">สาขาทั้งหมด</div>
                                    <div className="text-[20px] font-bold text-[#323338]">{branches.length}</div>
                                </div>
                                <div className="rounded-lg border border-[#e6e9ef] p-3">
                                    <div className="text-[10px] text-[#676879]">แผนกทั้งหมด</div>
                                    <div className="text-[20px] font-bold text-[#323338]">{departments.length}</div>
                                </div>
                            </div>
                            <div className="text-[12px] text-[#676879] space-y-1">
                                <div>สาขาแรก: <span className="font-semibold text-[#323338]">{branches[0] ? getScopeLabel(branches[0].label, branches[0].id) : '-'}</span></div>
                                <div>แผนกแรก: <span className="font-semibold text-[#323338]">{departments[0] ? getScopeLabel(departments[0].label, departments[0].id) : '-'}</span></div>
                                <div>สถานะ: <span className="font-semibold text-[#323338]">{isSaving ? 'กำลังบันทึกข้อมูล' : 'พร้อมแก้ไขและใช้งาน'}</span></div>
                            </div>
                        </div>

                        <div className="bg-white border border-[#d0d4e4] rounded-xl p-4 space-y-3">
                            <div className="text-[15px] font-semibold text-[#323338]">แนวทางการตั้งค่า</div>
                            <div className="space-y-2 text-[12px] text-[#676879]">
                                <div className="rounded-lg border border-[#e6e9ef] px-3 py-2">ใช้รหัสสั้นและคงที่ เช่น `branch-bkk`, `dept-finance` เพื่อให้อ้างอิงในระบบได้ง่าย</div>
                                <div className="rounded-lg border border-[#e6e9ef] px-3 py-2">ควรเพิ่มสาขาก่อน แล้วค่อยผูกแผนกเข้ากับสาขาที่ถูกต้อง</div>
                                <div className="rounded-lg border border-[#e6e9ef] px-3 py-2">ถ้าลบสาขา ระบบจะลบแผนกที่ผูกกับสาขานั้นตามไปด้วย</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
