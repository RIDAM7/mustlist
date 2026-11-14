import type { Rule } from '../types';
import { diagnostic, locationFromPath, rawString } from '../util';

/** `id` equals `<topic>/<stack>` from the path, and `topic` equals the folder. */
export const idPathRule: Rule = {
  id: 'id-path',
  description: 'id equals the file path; topic equals the folder',
  check: (context) => {
    const location = locationFromPath(context.card.filePath);
    if (!location) {
      return [
        diagnostic(context, 'id-path', 1, 'Card files must live at cards/<topic>/<stack>.md'),
      ];
    }
    const expectedId = `${location.topic}/${location.stack}`;
    const id = rawString(context, 'id');
    const topic = rawString(context, 'topic');
    const found = [];
    if (id !== undefined && id !== expectedId) {
      found.push(
        diagnostic(
          context,
          'id-path',
          context.card.lineOf(['id']),
          `id "${id}" must equal the file path "${expectedId}"`,
        ),
      );
    }
    if (topic !== undefined && topic !== location.topic) {
      found.push(
        diagnostic(
          context,
          'id-path',
          context.card.lineOf(['topic']),
          `topic "${topic}" must equal the folder name "${location.topic}"`,
        ),
      );
    }
    return found;
  },
};
