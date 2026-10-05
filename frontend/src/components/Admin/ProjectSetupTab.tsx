import React, { useState } from 'react';
import { labelsApi } from '../../api/labels';
import { useAuthStore } from '../../store/authStore';
import type { AdminTask } from '../../pages/admin/AdminProjectDetailPage';
import { LabelEditor } from '../TaskSetup/LabelEditor';
import { useAnnotationStore } from '../../store/annotationStore';
import { useToast } from "../Toast/ToastProvider";

interface Props {
  projectId: number;
  tasks: AdminTask[];
  onChanged: () => void;
}

export const ProjectSetupTab: React.FC<Props> = ({ projectId, tasks, onChanged }) => {
    const toast = useToast();
  const [sourceTaskId, setSourceTaskId] = useState<number | ''>('');
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  // Use the global annotation store for the label editor to work
  const setTask = useAnnotationStore((s) => s.setTask);
  const setLabels = useAnnotationStore((s) => s.setLabels);

  const handleSourceSelect = async (taskIdStr: string) => {
    const tid = taskIdStr ? Number(taskIdStr) : '';
    setSourceTaskId(tid);
    if (typeof tid === 'number') {
      setTask(tid);
      const labels = await labelsApi.list(tid);
      setLabels(labels);
    } else {
      setLabels([]);
    }
  };

  const handleSyncLabels = async () => {
    if (!sourceTaskId || typeof sourceTaskId !== 'number') return;
    if (!window.confirm('This will copy all labels from this task to all other tasks in the project. Continue?')) return;

    setSyncing(true);
    const targetTasks = tasks.filter((t) => t.id !== sourceTaskId);
    setProgress({ done: 0, total: targetTasks.length });

    try {
      const sourceLabels = await labelsApi.list(sourceTaskId);
      
      let done = 0;
      for (const targetTask of targetTasks) {
        const targetLabels = await labelsApi.list(targetTask.id);
        const targetLabelsByName = new Map(targetLabels.map(l => [l.name, l]));

        for (const sl of sourceLabels) {
          const existing = targetLabelsByName.get(sl.name);
          if (existing) {
            // Update
            await labelsApi.update(existing.id, {
              color: sl.color,
              attributes: sl.attributes || []
            });
          } else {
            // Create
            await labelsApi.create(targetTask.id, sl.name, sl.color, sl.attributes || []);
          }
        }
        done++;
        setProgress({ done, total: targetTasks.length });
      }
      toast.push('success', `Successfully synced labels to ${done} tasks!`);
      onChanged();
    } catch (e: any) {
      toast.push('error', e.userMessage ?? 'Something went wrong');
      toast.push('error', e.userMessage ?? 'Something went wrong');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <h2 className="font-medium text-slate-900 mb-4">Project-wide Labels Setup</h2>
        <p className="text-sm text-slate-500 mb-6">
          Define labels for one task, then click "Sync labels" to copy them to all other tasks in this project. 
          Existing labels with the same name will be updated.
        </p>

        <div className="mb-6 max-w-md">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Select Template Task
          </label>
          <select
            value={sourceTaskId}
            onChange={(e) => handleSourceSelect(e.target.value)}
            className="w-full rounded-md border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border py-2 px-3"
            disabled={syncing}
          >
            <option value="">-- Choose a task --</option>
            {tasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.task_type})
              </option>
            ))}
          </select>
        </div>

        {sourceTaskId !== '' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-medium text-slate-900 mb-3">Manage Labels</h3>
              <LabelEditor taskId={Number(sourceTaskId)} />
            </div>

            <div>
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-slate-900 mb-2">Sync to Project</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Push these labels to {tasks.length - 1} other tasks in the project.
                </p>
                <button
                  onClick={handleSyncLabels}
                  disabled={syncing || tasks.length <= 1}
                  className="w-full py-2 px-4 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 shadow-sm disabled:opacity-50"
                >
                  {syncing ? `Syncing (${progress.done}/${progress.total})...` : 'Sync Labels to All Tasks'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
