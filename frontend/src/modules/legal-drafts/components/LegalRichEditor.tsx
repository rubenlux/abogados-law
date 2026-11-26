import React, { useEffect, useState } from 'react';
import { Extension } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  IndentIncrease,
  IndentDecrease,
  Minus,
  Undo2,
  Redo2,
  ClipboardPaste,
} from 'lucide-react';
import type { LegalDocContent } from '../types';

/**
 * Extensión ligera de sangría (indent 0..6) compatible con el AST sanitizado AUTH-09
 * y con los generadores DOCX/PDF en backend.
 */
const ParagraphIndent = Extension.create({
  name: 'paragraphIndent',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const raw = element.getAttribute('data-indent');
              const parsed = raw ? parseInt(raw, 10) : 0;
              return Number.isInteger(parsed) && parsed >= 0 && parsed <= 6
                ? parsed
                : 0;
            },
            renderHTML: (attributes) => {
              const lvl = Number(attributes.indent) || 0;
              if (lvl <= 0) return {};
              return {
                'data-indent': String(lvl),
                style: `margin-left: ${lvl * 1.75}rem;`,
              };
            },
          },
        },
      },
    ];
  },
});

interface LegalRichEditorProps {
  initialContent: LegalDocContent;
  readOnly?: boolean;
  onChange?: (json: LegalDocContent) => void;
  editorKey?: string;
}

export const LegalRichEditor: React.FC<LegalRichEditorProps> = ({
  initialContent,
  readOnly = false,
  onChange,
  editorKey,
}) => {
  const [plainPasteOnly, setPlainPasteOnly] = useState(true);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        code: false,
        strike: false,
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      ParagraphIndent,
    ],
    content: initialContent,
    editable: !readOnly,
    editorProps: {
      attributes: {
        style:
          'min-height: 380px; padding: 1.5rem 2rem; outline: none; line-height: 1.65; font-size: 0.98rem; font-family: Georgia, "Times New Roman", serif;',
      },
      handlePaste: (view, event) => {
        if (!plainPasteOnly) return false;
        const text = event.clipboardData?.getData('text/plain');
        if (text !== undefined) {
          event.preventDefault();
          const { state, dispatch } = view;
          dispatch(state.tr.insertText(text));
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      if (onChange) {
        onChange(ed.getJSON() as LegalDocContent);
      }
    },
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor || !editorKey) return;
    editor.commands.setContent(initialContent, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, editorKey]);

  const adjustIndent = (delta: number) => {
    if (!editor || readOnly) return;
    const isHeading = editor.isActive('heading');
    const nodeType = isHeading ? 'heading' : 'paragraph';
    const current = Number(editor.getAttributes(nodeType).indent || 0);
    const next = Math.max(0, Math.min(6, current + delta));
    editor.chain().focus().updateAttributes(nodeType, { indent: next }).run();
  };

  if (!editor) {
    return (
      <div
        style={{
          padding: '2rem',
          border: '1px solid hsl(var(--hsl-border))',
          borderRadius: 'var(--radius-md)',
        }}
        className="text-muted"
      >
        Inicializando editor jurídico...
      </div>
    );
  }

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.35rem 0.5rem',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid hsl(var(--hsl-border))',
    background: active ? 'hsl(var(--hsl-primary))' : 'transparent',
    color: active ? '#fff' : 'hsl(var(--hsl-text-main))',
    cursor: readOnly ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.8rem',
    fontWeight: 600,
    opacity: readOnly ? 0.5 : 1,
  });

  return (
    <div
      style={{
        border: '1px solid hsl(var(--hsl-border))',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        background: 'hsl(var(--hsl-surface))',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.35rem',
          padding: '0.6rem 0.75rem',
          borderBottom: '1px solid hsl(var(--hsl-border))',
          background: 'hsl(var(--hsl-surface-muted))',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          title="Deshacer"
          disabled={readOnly || !editor.can().undo()}
          style={btnStyle(false)}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={14} />
        </button>
        <button
          type="button"
          title="Rehacer"
          disabled={readOnly || !editor.can().redo()}
          style={btnStyle(false)}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={14} />
        </button>

        <span style={{ width: 1, height: 20, background: 'hsl(var(--hsl-border))', margin: '0 0.15rem' }} />

        <button
          type="button"
          title="Párrafo normal"
          disabled={readOnly}
          style={btnStyle(editor.isActive('paragraph'))}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          P
        </button>
        <button
          type="button"
          title="Título principal"
          disabled={readOnly}
          style={btnStyle(editor.isActive('heading', { level: 2 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </button>
        <button
          type="button"
          title="Subtítulo de sección"
          disabled={readOnly}
          style={btnStyle(editor.isActive('heading', { level: 3 }))}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </button>

        <span style={{ width: 1, height: 20, background: 'hsl(var(--hsl-border))', margin: '0 0.15rem' }} />

        <button
          type="button"
          title="Negrita"
          disabled={readOnly}
          style={btnStyle(editor.isActive('bold'))}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={14} />
        </button>
        <button
          type="button"
          title="Cursiva"
          disabled={readOnly}
          style={btnStyle(editor.isActive('italic'))}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={14} />
        </button>
        <button
          type="button"
          title="Subrayado"
          disabled={readOnly}
          style={btnStyle(editor.isActive('underline'))}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon size={14} />
        </button>

        <span style={{ width: 1, height: 20, background: 'hsl(var(--hsl-border))', margin: '0 0.15rem' }} />

        <button
          type="button"
          title="Alinear a la izquierda"
          disabled={readOnly}
          style={btnStyle(editor.isActive({ textAlign: 'left' }))}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft size={14} />
        </button>
        <button
          type="button"
          title="Centrar"
          disabled={readOnly}
          style={btnStyle(editor.isActive({ textAlign: 'center' }))}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter size={14} />
        </button>
        <button
          type="button"
          title="Alinear a la derecha"
          disabled={readOnly}
          style={btnStyle(editor.isActive({ textAlign: 'right' }))}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight size={14} />
        </button>
        <button
          type="button"
          title="Justificar"
          disabled={readOnly}
          style={btnStyle(editor.isActive({ textAlign: 'justify' }))}
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        >
          <AlignJustify size={14} />
        </button>

        <span style={{ width: 1, height: 20, background: 'hsl(var(--hsl-border))', margin: '0 0.15rem' }} />

        <button
          type="button"
          title="Lista con viñetas"
          disabled={readOnly}
          style={btnStyle(editor.isActive('bulletList'))}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={14} />
        </button>
        <button
          type="button"
          title="Lista numerada"
          disabled={readOnly}
          style={btnStyle(editor.isActive('orderedList'))}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={14} />
        </button>
        <button
          type="button"
          title="Aumentar sangría"
          disabled={readOnly}
          style={btnStyle(false)}
          onClick={() => adjustIndent(1)}
        >
          <IndentIncrease size={14} />
        </button>
        <button
          type="button"
          title="Disminuir sangría"
          disabled={readOnly}
          style={btnStyle(false)}
          onClick={() => adjustIndent(-1)}
        >
          <IndentDecrease size={14} />
        </button>
        <button
          type="button"
          title="Insertar separador horizontal"
          disabled={readOnly}
          style={btnStyle(false)}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus size={14} />
        </button>

        <button
          type="button"
          title="Pegado de texto sin formato (activo por seguridad)"
          disabled={readOnly}
          style={{ ...btnStyle(plainPasteOnly), marginLeft: 'auto', gap: '0.3rem' }}
          onClick={() => setPlainPasteOnly((v) => !v)}
        >
          <ClipboardPaste size={14} />
          <span>{plainPasteOnly ? 'Pegado plano ON' : 'Pegado plano OFF'}</span>
        </button>
      </div>

      {/* Document Canvas */}
      <div style={{ background: 'hsl(var(--hsl-surface))' }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

