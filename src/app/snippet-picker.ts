/** DI hook for snippet picker — Pro injects the implementation */

type SnippetPickerFn = (onSelect: (command: string) => void) => void;

let pickerFn: SnippetPickerFn | null = null;

export function setSnippetPicker(fn: SnippetPickerFn): void {
  pickerFn = fn;
}

export function showSnippetPicker(onSelect: (command: string) => void): void {
  pickerFn?.(onSelect);
}
