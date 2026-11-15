import { renderCommentMarkdown } from '@/lib/markdown';
import { personBadge } from './index';
import type { Comment, Person } from './types';

/** Comments with their markdown rendered once, on the server. */
export interface RenderedComment {
  id: string;
  author: string;
  date: string;
  html: string;
  /** "Maintainer" or "Reviewer" next to the name. */
  badge?: string;
  /** The comment on GitHub. */
  url?: string;
  replies: RenderedComment[];
}

export function renderComments(comments: Comment[], people: Person[]): RenderedComment[] {
  return comments.map((comment) => {
    const badge = personBadge(people, comment.author);
    return {
      id: comment.id,
      author: comment.author,
      date: comment.date,
      html: renderCommentMarkdown(comment.body),
      ...(badge ? { badge } : {}),
      ...(comment.url ? { url: comment.url } : {}),
      replies: renderComments(comment.replies ?? [], people),
    };
  });
}
