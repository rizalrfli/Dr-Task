export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'done';
export type DueBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later';

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate: string;
  dueTime?: string;
  priority: Priority;
  status: TaskStatus;
  category?: string;
  notify: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface FilterState {
  bucket: 'all' | DueBucket;
  priority: 'all' | Priority;
  query: string;
}
