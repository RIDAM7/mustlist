import type { Diagnostic } from './types';

/** `file:line  rule-id  message`, one per line, then a summary line. */
export function formatText(diagnostics: readonly Diagnostic[]): string {
  const lines = diagnostics.map(
    (item) =>
      `${item.file}:${item.line}  ${item.rule}  ${item.severity === 'warning' ? 'warning: ' : ''}${item.message}`,
  );
  return [...lines, summaryLine(diagnostics)].join('\n');
}

export function summaryLine(diagnostics: readonly Diagnostic[]): string {
  const errors = diagnostics.filter((item) => item.severity === 'error').length;
  const warnings = diagnostics.length - errors;
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  return `${plural(errors, 'error')}, ${plural(warnings, 'warning')}`;
}

export function formatJson(diagnostics: readonly Diagnostic[]): string {
  const errors = diagnostics.filter((item) => item.severity === 'error').length;
  return JSON.stringify({ errors, warnings: diagnostics.length - errors, diagnostics }, null, 2);
}

/** GitHub Actions workflow commands, which show up as annotations on the PR. */
export function formatGithubAnnotations(diagnostics: readonly Diagnostic[]): string {
  const escape = (value: string) =>
    value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  const escapeProperty = (value: string) => escape(value).replace(/:/g, '%3A').replace(/,/g, '%2C');
  return diagnostics
    .map(
      (item) =>
        `::${item.severity} file=${escapeProperty(item.file)},line=${item.line},title=${escapeProperty(item.rule)}::${escape(item.message)}`,
    )
    .join('\n');
}
