'use client';

import React, { useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { ArrowLeft, Printer } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Task } from '@/types/construction';
import { useAppContext } from '@/contexts/AppContext';
import { getTaskOwnerNames as resolveTaskOwnerNames } from '@/utils/taskOwnerUtils';
import { getPriorityLabel, getStatusLabel } from '@/utils/statusUtils';

type ReportRow = {
  id: string;
  category: string;
  name: string;
  status: Task['status'];
  priorityLabel: string;
  priorityClass: string;
  ownerLabel: string;
  crewLabel: string;
  startDateLabel: string;
  endDateLabel: string;
};

const toDateLabel = (isoValue?: string) => {
  if (!isoValue) return '-';
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return '-';
  return format(parsed, 'dd/MM/yyyy');
};

const toDateKey = (isoValue?: string) => {
  if (!isoValue) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoValue)) return isoValue;
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return '';
  return format(parsed, 'yyyy-MM-dd');
};

const isTaskActiveOnDate = (task: Task, dateKey: string) => {
  const startKey = toDateKey(task.planStartDate);
  const endKey = toDateKey(task.planEndDate);
  if (!startKey && !endKey) return false;
  if (startKey && endKey) return startKey <= dateKey && dateKey <= endKey;
  if (startKey) return startKey === dateKey;
  return endKey === dateKey;
};

const getPriorityMeta = (priority?: Task['priority']) => {
  switch (priority) {
    case 'urgent':
      return { label: getPriorityLabel(priority), className: 'bg-[#fff1f2] border-[#fecdd3] text-[#9f1239]' };
    case 'high':
      return { label: getPriorityLabel(priority), className: 'bg-[#fff7ed] border-[#fed7aa] text-[#9a3412]' };
    case 'medium':
      return { label: getPriorityLabel(priority), className: 'bg-[#eef4ff] border-[#c9d8f5] text-[#1b4f92]' };
    case 'low':
      return { label: getPriorityLabel(priority), className: 'bg-[#f8fafc] border-[#d6dde7] text-[#475569]' };
    default:
      return { label: getPriorityLabel(priority), className: 'bg-[#f8fafc] border-[#d6dde7] text-[#64748b]' };
  }
};

const getStatusBadgeClass = (status: Task['status']) => {
  switch (status) {
    case 'completed':
      return 'bg-[#eaf3ff] border-[#bfd3f3] text-[#103f77]';
    case 'in-progress':
      return 'bg-[#eef4ff] border-[#c9d8f5] text-[#1b4f92]';
    case 'not-started':
      return 'bg-[#f5f7fa] border-[#d4dbe5] text-[#475569]';
    case 'delayed':
      return 'bg-[#fff2f2] border-[#f5c8ce] text-[#a22a3c]';
    default:
      return 'bg-[#f5f7fa] border-[#d4dbe5] text-[#475569]';
  }
};

function ReportTable({ title, rows }: { title: string; rows: ReportRow[] }) {
  return (
    <section className="border border-[#cfd8e6] rounded-lg overflow-hidden bg-white">
      <div className="px-4 py-2 bg-[#eef3f9] border-b border-[#d3ddea]">
        <h2 className="text-[13px] font-bold text-[#16283d]">{title}</h2>
      </div>
      {rows.length === 0 ? (
        <div className="px-4 py-4 text-[12px] text-[#5f7084]">ไม่มีงานในช่วงเวลานี้</div>
      ) : (
        <div className="overflow-x-auto report-table-wrap">
          <table className="w-full min-w-[960px] text-[12px] report-table">
            <colgroup>
              <col className="w-[52px]" />
              <col className="w-[110px]" />
              <col className="w-[320px]" />
              <col className="w-[170px]" />
              <col className="w-[138px]" />
              <col className="w-[118px]" />
            </colgroup>
            <thead className="bg-[#e8eef6]">
              <tr>
                <th className="px-2.5 py-2.5 text-left font-bold text-[#23364d] border-b border-[#cfd9e6]">ลำดับ</th>
                <th className="px-2.5 py-2.5 text-left font-bold text-[#23364d] border-b border-[#cfd9e6]">หมวดหมู่</th>
                <th className="px-3 py-2.5 text-left font-bold text-[#23364d] border-b border-[#cfd9e6]">งาน</th>
                <th className="px-2.5 py-2.5 text-left font-bold text-[#23364d] border-b border-[#cfd9e6]">
                  <div className="flex flex-col leading-[1.2]">
                    <span>ผู้รับผิดชอบ</span>
                    <span className="mt-1 text-[#5f7084] font-semibold">ทีมช่าง</span>
                  </div>
                </th>
                <th className="px-2.5 py-2.5 text-left font-bold text-[#23364d] border-b border-[#cfd9e6]">
                  <div className="flex flex-col leading-[1.2]">
                    <span>วันที่เริ่ม</span>
                    <span className="mt-1 text-[#5f7084] font-semibold">วันที่สิ้นสุด</span>
                  </div>
                </th>
                <th className="px-2.5 py-2.5 text-left font-bold text-[#23364d] border-b border-[#cfd9e6]">
                  <div className="flex flex-col leading-[1.2]">
                    <span>สถานะ</span>
                    <span className="mt-1 text-[#5f7084] font-semibold">ความสำคัญ</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className={`border-b border-[#e6ecf3] last:border-b-0 ${index % 2 === 0 ? 'bg-white' : 'bg-[#fbfdff]'}`}>
                  <td className="px-2.5 py-1.5 text-[#5f7084] align-top">{index + 1}</td>
                  <td className="px-2.5 py-1.5 text-[#5f7084] whitespace-normal break-normal [overflow-wrap:anywhere] align-top">{row.category}</td>
                  <td className="px-3 py-1.5 text-[#1f3147] whitespace-normal break-normal [overflow-wrap:anywhere] leading-relaxed align-top">{row.name}</td>
                  <td className="px-2.5 py-1.5 align-top">
                    <div className="flex flex-col gap-1.5">
                      <div className="text-[#435468] whitespace-normal break-normal [overflow-wrap:anywhere]">{row.ownerLabel}</div>
                      <div className="text-[#66788d] whitespace-normal break-normal [overflow-wrap:anywhere]">{row.crewLabel}</div>
                    </div>
                  </td>
                  <td className="px-2.5 py-1.5 align-top">
                    <div className="flex flex-col gap-1.5">
                      <div className="text-[#1f3147]">{row.startDateLabel}</div>
                      <div className="text-[#1f3147]">{row.endDateLabel}</div>
                    </div>
                  </td>
                  <td className="px-2.5 py-1.5 align-top">
                    <div className="flex flex-col gap-1.5">
                      <span className={`inline-flex w-fit items-center px-2 py-1 rounded text-[10px] font-semibold border whitespace-nowrap ${getStatusBadgeClass(row.status)}`}>
                        {getStatusLabel(row.status)}
                      </span>
                      <span className={`inline-flex w-fit items-center px-2 py-1 rounded text-[10px] font-semibold border whitespace-nowrap ${row.priorityClass}`}>
                        {row.priorityLabel}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function CompletedTwoDayReportPage() {
  const router = useRouter();
  const { projects, tasks, teamMembers, activeProjectId } = useAppContext();
  const [selectedReportDateKey, setSelectedReportDateKey] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const activeProject = projects.find((project) => project.id === activeProjectId);
  const projectTasks = tasks.filter((task) => task.projectId === activeProjectId);

  const report = useMemo(() => {
    const selectedDate = new Date(`${selectedReportDateKey}T00:00:00`);
    const safeSelectedDate = Number.isNaN(selectedDate.getTime()) ? new Date() : selectedDate;
    const selectedDateKey = format(safeSelectedDate, 'yyyy-MM-dd');
    const nextDate = addDays(safeSelectedDate, 1);
    const nextDateKey = format(nextDate, 'yyyy-MM-dd');
    const memberTypeByName = new Map<string, 'team' | 'crew'>(
      teamMembers.map((member) => [member.name, member.memberType === 'crew' ? 'crew' : 'team'])
    );

    const sortedForDocument = (items: Task[]) =>
      [...items].sort((a, b) => {
        const aStart = new Date(a.planStartDate || '').getTime();
        const bStart = new Date(b.planStartDate || '').getTime();
        if (aStart !== bStart) return aStart - bStart;
        const aEnd = new Date(a.planEndDate || '').getTime();
        const bEnd = new Date(b.planEndDate || '').getTime();
        return aEnd - bEnd;
      });

    const mapRows = (items: Task[]): ReportRow[] =>
      sortedForDocument(items).map((task) => {
        const assignedNames = resolveTaskOwnerNames(task, teamMembers);
        const ownerNames = assignedNames.filter((name) => memberTypeByName.get(name) !== 'crew');
        const crewNames = assignedNames.filter((name) => memberTypeByName.get(name) === 'crew');
        const priorityMeta = getPriorityMeta(task.priority);
        return {
          id: task.id,
          category: task.category || 'ไม่มีหมวดหมู่',
          name: task.name,
          status: task.status,
          priorityLabel: priorityMeta.label,
          priorityClass: priorityMeta.className,
          ownerLabel: ownerNames.length > 0 ? ownerNames.join(', ') : 'ยังไม่ระบุ',
          crewLabel: crewNames.length > 0 ? crewNames.join(', ') : '-',
          startDateLabel: toDateLabel(task.planStartDate),
          endDateLabel: toDateLabel(task.planEndDate),
        };
      });

    const todayRows = mapRows(
      projectTasks.filter((task) => isTaskActiveOnDate(task, selectedDateKey))
    );
    const tomorrowRows = mapRows(
      projectTasks.filter((task) => isTaskActiveOnDate(task, nextDateKey))
    );

    return {
      generatedAt: format(new Date(), 'dd/MM/yyyy HH:mm'),
      todayDateLabel: format(safeSelectedDate, 'dd/MM/yyyy'),
      tomorrowDateLabel: format(nextDate, 'dd/MM/yyyy'),
      todayRows,
      tomorrowRows,
      todayDoneCount: todayRows.length,
      tomorrowDoneCount: tomorrowRows.length,
      twoDayDoneCount: todayRows.length + tomorrowRows.length,
      totalCompletedCount: projectTasks.filter((task) => task.status === 'completed').length,
    };
  }, [projectTasks, selectedReportDateKey, teamMembers]);

  return (
    <div className="min-h-screen bg-[#f5f6f8] p-4 sm:p-6 lg:p-8">
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body * {
            visibility: hidden !important;
          }
          .print-area,
          .print-area * {
            visibility: visible !important;
          }
          .print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
          }
          .no-print {
            display: none !important;
          }
          .report-paper {
            border: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }
          body {
            background: #ffffff !important;
          }
          .report-table-wrap {
            overflow: visible !important;
          }
          .report-table {
            min-width: 0 !important;
            width: 100% !important;
            table-layout: auto !important;
            font-size: 11px !important;
          }
          .report-table th,
          .report-table td {
            white-space: normal !important;
            word-break: normal !important;
            overflow-wrap: break-word !important;
            vertical-align: top !important;
          }
          .report-table th {
            font-size: 10.5px !important;
            line-height: 1.3 !important;
            letter-spacing: 0.01em !important;
          }
        }
      `}</style>

      <div className="max-w-[1120px] mx-auto space-y-4">
        <div className="no-print flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 px-3 py-2 text-[13px] rounded-lg border border-[#d0d4e4] bg-white text-[#323338] hover:bg-[#f5f6f8]"
            >
              <ArrowLeft className="w-4 h-4" />
              กลับ
            </button>
            <label className="inline-flex items-center gap-2 px-3 py-2 text-[13px] rounded-lg border border-[#d0d4e4] bg-white text-[#323338]">
              <span className="font-medium">วันที่รายงาน</span>
              <input
                type="date"
                value={selectedReportDateKey}
                onChange={(event) => setSelectedReportDateKey(event.target.value)}
                className="rounded border border-[#d0d4e4] px-2 py-1 text-[13px] outline-none focus:ring-2 focus:ring-[#0073ea]/20 focus:border-[#0073ea]"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-semibold rounded-lg bg-[#0073ea] text-white hover:bg-[#0060c0]"
          >
            <Printer className="w-4 h-4" />
            พิมพ์ / บันทึก PDF
          </button>
        </div>

        <article className="print-area report-paper bg-white border border-[#cfd8e6] rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
          <header className="border border-[#d5dfec] rounded-lg overflow-hidden">
            <div className="bg-[#14365a] px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/80 font-semibold">รายงานโครงการบริษัท</div>
                <h1 className="text-[19px] sm:text-[21px] font-black text-white leading-tight">เอกสารประเมินผลงาน 2 วัน</h1>
              </div>
              <div className="text-right text-white/90 text-[10px]">
                <div>รหัสเอกสาร: RPT-2D-{selectedReportDateKey.replaceAll('-', '')}</div>
                <div>การแก้ไข: 01</div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0">
              <div className="px-4 py-2.5 border-r border-b border-[#dbe4f0]">
                <div className="text-[10px] uppercase tracking-wider text-[#6f8196] font-semibold">ชื่อโครงการ</div>
                <div className="mt-1 text-[12px] font-semibold text-[#1f3147] break-words">{activeProject?.name || 'ไม่ได้เลือกโครงการ'}</div>
              </div>
              <div className="px-4 py-2.5 border-r border-b border-[#dbe4f0]">
                <div className="text-[10px] uppercase tracking-wider text-[#6f8196] font-semibold">ช่วงเวลาที่รายงาน</div>
                <div className="mt-1 text-[12px] font-semibold text-[#1f3147]">{report.todayDateLabel} - {report.tomorrowDateLabel}</div>
              </div>
              <div className="px-4 py-2.5 border-r border-b border-[#dbe4f0]">
                <div className="text-[10px] uppercase tracking-wider text-[#6f8196] font-semibold">ออกเอกสารเมื่อ</div>
                <div className="mt-1 text-[12px] font-semibold text-[#1f3147]">{report.generatedAt}</div>
              </div>
              <div className="px-4 py-2.5 border-b border-[#dbe4f0]">
                <div className="text-[10px] uppercase tracking-wider text-[#6f8196] font-semibold">จัดทำโดย</div>
                <div className="mt-1 text-[12px] font-semibold text-[#1f3147]">POWERTEC ENGINEERING CO., LTD.</div>
              </div>
            </div>
          </header>

          <ReportTable
            title={`วันที่เลือก (${report.todayDateLabel}) - ${report.todayDoneCount} งาน`}
            rows={report.todayRows}
          />
          <ReportTable
            title={`วันถัดไป (${report.tomorrowDateLabel}) - ${report.tomorrowDoneCount} งาน`}
            rows={report.tomorrowRows}
          />

          <section className="grid grid-cols-2 gap-4 pt-4 border-t border-[#d9e2ee]">
            <div className="border border-[#d2dceb] rounded-lg px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-[#6f8196] font-semibold">ผู้จัดทำ</div>
              <div className="mt-8 border-t border-[#dbe4ef] pt-2 text-[12px] text-[#1f3147]">____________________________</div>
              <div className="text-[11px] text-[#6f8196]">ชื่อ / ตำแหน่ง / วันที่</div>
            </div>
            <div className="border border-[#d2dceb] rounded-lg px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-[#6f8196] font-semibold">ผู้อนุมัติ</div>
              <div className="mt-8 border-t border-[#dbe4ef] pt-2 text-[12px] text-[#1f3147]">____________________________</div>
              <div className="text-[11px] text-[#6f8196]">ชื่อ / ตำแหน่ง / วันที่</div>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
