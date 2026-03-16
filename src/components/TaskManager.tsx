"use client";

import { useState, useEffect, useMemo } from "react";
import { Task, TaskType, TaskStatus, TaskPriority, TaskCategory } from "@/lib/types";
import { getTasks, addTask, updateTask, deleteTask } from "@/lib/storage";

const CATEGORIES: TaskCategory[] = ["経営判断", "契約・支払い", "スタッフ管理", "集客・広告", "施術・技術", "設備・備品", "その他"];

const TYPE_LABELS: Record<TaskType, string> = {
  "approval": "承認待ち",
  "owner-task": "社長タスク",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  "pending": "未対応",
  "in-progress": "対応中",
  "completed": "完了",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  "pending": "bg-orange-100 text-orange-700",
  "in-progress": "bg-blue-100 text-blue-700",
  "completed": "bg-green-100 text-green-700",
};

export default function TaskManager() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterType, setFilterType] = useState<TaskType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<TaskStatus | "all">("all");
  const [filterCategory, setFilterCategory] = useState<TaskCategory | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);

  // フォーム
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState<TaskType>("owner-task");
  const [formCategory, setFormCategory] = useState<TaskCategory>("その他");
  const [formPriority, setFormPriority] = useState<TaskPriority>("medium");
  const [formDueDate, setFormDueDate] = useState("");
  const [formRequestedBy, setFormRequestedBy] = useState("");
  const [formMemo, setFormMemo] = useState("");

  useEffect(() => {
    setTasks(getTasks());
  }, []);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterType !== "all" && t.type !== filterType) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (!showCompleted && t.status === "completed") return false;
      return true;
    }).sort((a, b) => {
      // 優先度順 → 期限順
      const pOrder = { high: 0, medium: 1, low: 2 };
      if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [tasks, filterType, filterStatus, filterCategory, showCompleted]);

  const counts = useMemo(() => {
    const pending = tasks.filter((t) => t.status !== "completed");
    return {
      total: pending.length,
      approval: pending.filter((t) => t.type === "approval").length,
      ownerTask: pending.filter((t) => t.type === "owner-task").length,
      high: pending.filter((t) => t.priority === "high").length,
      overdue: pending.filter((t) => t.dueDate && new Date(t.dueDate) < new Date(new Date().toDateString())).length,
    };
  }, [tasks]);

  function resetForm() {
    setFormTitle("");
    setFormDescription("");
    setFormType("owner-task");
    setFormCategory("その他");
    setFormPriority("medium");
    setFormDueDate("");
    setFormRequestedBy("");
    setFormMemo("");
    setEditingTask(null);
    setShowForm(false);
  }

  function openEditForm(task: Task) {
    setFormTitle(task.title);
    setFormDescription(task.description);
    setFormType(task.type);
    setFormCategory(task.category);
    setFormPriority(task.priority);
    setFormDueDate(task.dueDate || "");
    setFormRequestedBy(task.requestedBy || "");
    setFormMemo(task.memo || "");
    setEditingTask(task);
    setShowForm(true);
  }

  function handleSubmit() {
    if (!formTitle.trim()) return;

    if (editingTask) {
      updateTask(editingTask.id, {
        title: formTitle,
        description: formDescription,
        type: formType,
        category: formCategory,
        priority: formPriority,
        dueDate: formDueDate || undefined,
        requestedBy: formRequestedBy || undefined,
        memo: formMemo || undefined,
      });
    } else {
      const newTask: Task = {
        id: `task-${Date.now()}`,
        title: formTitle,
        description: formDescription,
        type: formType,
        category: formCategory,
        priority: formPriority,
        status: "pending",
        dueDate: formDueDate || undefined,
        requestedBy: formRequestedBy || undefined,
        createdAt: new Date().toISOString(),
        memo: formMemo || undefined,
      };
      addTask(newTask);
    }
    setTasks(getTasks());
    resetForm();
  }

  function handleStatusChange(task: Task, newStatus: TaskStatus) {
    const updates: Partial<Task> = { status: newStatus };
    if (newStatus === "completed") updates.completedAt = new Date().toISOString();
    else updates.completedAt = undefined;
    updateTask(task.id, updates);
    setTasks(getTasks());
  }

  function handleDelete(id: string) {
    deleteTask(id);
    setTasks(getTasks());
  }

  function isOverdue(task: Task): boolean {
    if (!task.dueDate || task.status === "completed") return false;
    return new Date(task.dueDate) < new Date(new Date().toDateString());
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  return (
    <div className="space-y-6">
      {/* サマリーカード */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-2xl font-bold text-gray-800">{counts.total}</div>
          <div className="text-xs text-gray-500 mt-1">未完了タスク</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border cursor-pointer hover:bg-orange-50" onClick={() => { setFilterType("approval"); setFilterStatus("all"); }}>
          <div className="text-2xl font-bold text-orange-600">{counts.approval}</div>
          <div className="text-xs text-gray-500 mt-1">承認待ち</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border cursor-pointer hover:bg-blue-50" onClick={() => { setFilterType("owner-task"); setFilterStatus("all"); }}>
          <div className="text-2xl font-bold text-blue-600">{counts.ownerTask}</div>
          <div className="text-xs text-gray-500 mt-1">社長タスク</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border cursor-pointer hover:bg-red-50" onClick={() => { setFilterType("all"); setFilterStatus("all"); }}>
          <div className="text-2xl font-bold text-red-600">{counts.high}</div>
          <div className="text-xs text-gray-500 mt-1">優先度 高</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className={`text-2xl font-bold ${counts.overdue > 0 ? "text-red-600" : "text-green-600"}`}>{counts.overdue}</div>
          <div className="text-xs text-gray-500 mt-1">期限超過</div>
        </div>
      </div>

      {/* フィルター＋追加ボタン */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value as TaskType | "all")} className="border rounded-lg px-3 py-2 text-sm bg-white">
          <option value="all">全タイプ</option>
          <option value="approval">承認待ち</option>
          <option value="owner-task">社長タスク</option>
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as TaskStatus | "all")} className="border rounded-lg px-3 py-2 text-sm bg-white">
          <option value="all">全ステータス</option>
          <option value="pending">未対応</option>
          <option value="in-progress">対応中</option>
          <option value="completed">完了</option>
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value as TaskCategory | "all")} className="border rounded-lg px-3 py-2 text-sm bg-white">
          <option value="all">全カテゴリ</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm text-gray-500 ml-2">
          <input type="checkbox" checked={showCompleted} onChange={(e) => setShowCompleted(e.target.checked)} />
          完了も表示
        </label>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="ml-auto bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          + タスク追加
        </button>
      </div>

      {/* 追加/編集フォーム */}
      {showForm && (
        <div className="bg-white rounded-xl p-6 shadow-sm border space-y-4">
          <h3 className="font-bold text-lg">{editingTask ? "タスク編集" : "新規タスク"}</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">タイトル *</label>
              <input type="text" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="例: 新しい施術メニューの料金を決める" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">タイプ</label>
              <select value={formType} onChange={(e) => setFormType(e.target.value as TaskType)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="owner-task">社長タスク（自分でやる）</option>
                <option value="approval">承認待ち（確認・判断が必要）</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
              <select value={formCategory} onChange={(e) => setFormCategory(e.target.value as TaskCategory)} className="w-full border rounded-lg px-3 py-2 text-sm">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">優先度</label>
              <select value={formPriority} onChange={(e) => setFormPriority(e.target.value as TaskPriority)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="high">高（すぐ対応）</option>
                <option value="medium">中（今週中）</option>
                <option value="low">低（余裕がある時）</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">期限</label>
              <input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>

            {formType === "approval" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">依頼者</label>
                <input type="text" value={formRequestedBy} onChange={(e) => setFormRequestedBy(e.target.value)} placeholder="例: スタッフ名" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">詳細</label>
              <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="詳細や背景を入力" rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
              <textarea value={formMemo} onChange={(e) => setFormMemo(e.target.value)} placeholder="判断材料、進捗メモなど" rows={2} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={resetForm} className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">キャンセル</button>
            <button onClick={handleSubmit} disabled={!formTitle.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {editingTask ? "更新" : "追加"}
            </button>
          </div>
        </div>
      )}

      {/* タスクリスト */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-2">✓</div>
          <div>タスクはありません</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <div key={task.id} className={`bg-white rounded-xl p-4 shadow-sm border ${isOverdue(task) ? "border-red-300 bg-red-50" : ""} ${task.status === "completed" ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                {/* ステータス切替ボタン */}
                <button
                  onClick={() => {
                    const next: Record<TaskStatus, TaskStatus> = { pending: "in-progress", "in-progress": "completed", completed: "pending" };
                    handleStatusChange(task, next[task.status]);
                  }}
                  className={`mt-0.5 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs ${
                    task.status === "completed"
                      ? "bg-green-500 border-green-500 text-white"
                      : task.status === "in-progress"
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {task.status === "completed" ? "✓" : task.status === "in-progress" ? "●" : ""}
                </button>

                {/* メイン内容 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${task.status === "completed" ? "line-through text-gray-400" : "text-gray-800"}`}>
                      {task.title}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${PRIORITY_COLORS[task.priority]}`}>
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status]}`}>
                      {STATUS_LABELS[task.status]}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${task.type === "approval" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                      {TYPE_LABELS[task.type]}
                    </span>
                  </div>

                  {task.description && (
                    <p className="text-xs text-gray-500 mt-1">{task.description}</p>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>{task.category}</span>
                    {task.dueDate && (
                      <span className={isOverdue(task) ? "text-red-500 font-medium" : ""}>
                        期限: {formatDate(task.dueDate)}{isOverdue(task) && " (超過)"}
                      </span>
                    )}
                    {task.requestedBy && <span>依頼: {task.requestedBy}</span>}
                    <span>作成: {formatDate(task.createdAt)}</span>
                    {task.completedAt && <span>完了: {formatDate(task.completedAt)}</span>}
                  </div>

                  {task.memo && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">{task.memo}</div>
                  )}
                </div>

                {/* 操作ボタン */}
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => openEditForm(task)} className="text-gray-400 hover:text-blue-600 p-1" title="編集">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button onClick={() => handleDelete(task.id)} className="text-gray-400 hover:text-red-600 p-1" title="削除">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
