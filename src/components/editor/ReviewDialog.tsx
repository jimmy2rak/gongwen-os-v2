// ─── 公文审阅对话框 ────────────────────────────
// 选择部门 → 选择审阅人 → 通过/驳回
// 审阅人列表从 /api/reviewers 读取，存入 reviews 数据表

"use client";

import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, X } from "lucide-react";

interface Reviewer {
  id: string;
  name: string;
  department: string;
}

interface ReviewDialogProps {
  open: boolean;
  onClose: () => void;
  onReview: (reviewerId: string, reviewerName: string, approved: boolean) => void;
}

export function ReviewDialog({ open, onClose, onReview }: ReviewDialogProps) {
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedPerson, setSelectedPerson] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/reviewers")
      .then((r) => r.json())
      .then((body) => {
        if (body.success) {
          const list: Reviewer[] = body.data || [];
          setReviewers(list);
          setDepartments(Array.from(new Set(list.map((r) => r.department))));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    setSelectedDept("");
    setSelectedPerson("");
  }, [open]);

  const filteredReviewers = selectedDept
    ? reviewers.filter((r) => r.department === selectedDept)
    : [];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-800">公文审阅</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-6 text-sm text-gray-400">加载审阅人...</div>
        ) : reviewers.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-400">
            暂无审阅人，请在系统设置中添加审阅人
          </div>
        ) : (
          <>
            {/* 选择部门 */}
            <div className="mb-3">
              <label className="block text-xs text-gray-500 mb-1.5">选择部门</label>
              <div className="flex flex-wrap gap-1.5">
                {departments.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => { setSelectedDept(dept); setSelectedPerson(""); }}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                      selectedDept === dept
                        ? "bg-red-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            {/* 选择人员 */}
            {selectedDept && (
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1.5">选择审阅人</label>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {filteredReviewers.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedPerson(r.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedPerson === r.id
                          ? "bg-red-50 text-red-700 border border-red-200"
                          : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent"
                      }`}
                    >
                      {r.name}
                      <span className="text-[10px] text-gray-400 ml-2">{r.department}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (selectedPerson) {
                    const reviewer = reviewers.find((r) => r.id === selectedPerson);
                    onReview(selectedPerson, reviewer?.name || "", true);
                  }
                }}
                disabled={!selectedPerson}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 disabled:bg-gray-300 transition-colors"
              >
                <CheckCircle className="w-4 h-4" />通过审阅
              </button>
              <button
                onClick={() => {
                  if (selectedPerson) {
                    const reviewer = reviewers.find((r) => r.id === selectedPerson);
                    onReview(selectedPerson, reviewer?.name || "", false);
                  }
                }}
                disabled={!selectedPerson}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 bg-white border border-orange-300 text-orange-600 text-xs rounded-lg hover:bg-orange-50 disabled:border-gray-200 disabled:text-gray-300 transition-colors"
              >
                <AlertCircle className="w-4 h-4" />驳回
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
