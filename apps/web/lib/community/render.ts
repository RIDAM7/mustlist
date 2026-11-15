import { renderCommentMarkdown } from '@/lib/markdown';
import type { Comment } from './types';

/** Comments with their markdown rendered once, on the server. */
export interface RenderedComment {
  id: string;
  author: string;
  date: string;
  html: string;
  replies: RenderedComment[];
}

export function renderComments(comments: Comment[]): RenderedComment[] {
  return comments.map((comment) => ({
    id: comment.id,
    author: comment.author,
    date: comment.date,
    html: renderCommentMarkdown(comment.body),
    replies: renderComments(comment.replies ?? []),
  }));
}
