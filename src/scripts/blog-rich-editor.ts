import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';

export function createPostEditor(element: HTMLElement, onUpdate: (markdown: string) => void, onSelection: () => void) {
  return new Editor({
    element,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false }, underline: false }),
      TableKit.configure({ table: { resizable: false } }),
      Image.configure({ allowBase64: false }),
      Markdown,
    ],
    content: '',
    contentType: 'markdown',
    editorProps: {
      attributes: { class: 'prose post-document', role: 'textbox', 'aria-label': 'Article content', 'aria-multiline': 'true', 'data-placeholder': 'Start writing your article…' },
    },
    onUpdate: ({ editor }) => onUpdate(editor.getMarkdown()),
    onSelectionUpdate: onSelection,
  });
}
