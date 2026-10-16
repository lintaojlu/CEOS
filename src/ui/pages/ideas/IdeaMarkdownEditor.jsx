import React, { useRef, useState } from 'react';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Image from '@tiptap/extension-image';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Extension } from '@tiptap/core';
import { canonicalImageMarkdown, createIdeaId } from '../../../domain/ideas/idea-document.js';

const IMAGE_TYPES = /^image\/(png|jpeg|gif|webp)$/;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const IdeaImageStore = Extension.create({
  name: 'ideaImageStore',
  addStorage() {
    return { get: () => null };
  }
});

function IdeaImageView({ node, editor }) {
  const src = String(node.attrs.src || '');
  const match = src.match(/^idea-image:([A-Za-z0-9-]{1,80})$/);
  const stored = match ? editor.storage.ideaImageStore?.get?.(match[1]) : null;
  const url = stored ? `data:${stored.mime};base64,${stored.base64}` : '';
  return (
    <NodeViewWrapper className="idea-image">
      {url ? <img src={url} alt="" /> : <span className="idea-image-missing">图片缺失</span>}
    </NodeViewWrapper>
  );
}

const IdeaImage = Image.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      inline: true,
      allowBase64: false
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(IdeaImageView);
  }
});

/** @param {File} file */
function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !IMAGE_TYPES.test(file.type)) {
      reject(new Error('只支持 png、jpeg、gif、webp'));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      reject(new Error('图片太大'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        reject(new Error('图片读不出来'));
        return;
      }
      resolve({ mime: match[1], base64: match[2] });
    };
    reader.onerror = () => reject(new Error('图片读不出来'));
    reader.readAsDataURL(file);
  });
}

/** @param {DataTransfer|null|undefined} transfer */
function imageFiles(transfer) {
  const files = [];
  const list = transfer?.files ? [...transfer.files] : [];
  for (const file of list) {
    if (IMAGE_TYPES.test(file.type)) files.push(file);
  }
  return files;
}

/**
 * @param {object} props
 * @param {string} props.body
 * @param {Record<string, { mime: string, base64: string }>} props.images
 * @param {(next: { body: string, images: Record<string, { mime: string, base64: string }> }) => void} props.onChange
 */
export function IdeaMarkdownEditor({ body, images, onChange }) {
  const imagesRef = useRef(images || {});
  imagesRef.current = images || imagesRef.current;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editorRef = useRef(null);
  const [error, setError] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        underline: false,
        link: { openOnClick: false, autolink: true }
      }),
      Markdown,
      TaskList,
      TaskItem.configure({ nested: false }),
      IdeaImage,
      IdeaImageStore
    ],
    content: body || '',
    contentType: 'markdown',
    autofocus: 'end',
    editorProps: {
      handlePaste(_view, event) {
        const files = imageFiles(event.clipboardData);
        if (!files.length) return false;
        event.preventDefault();
        addFiles(files);
        return true;
      },
      handleDrop(_view, event) {
        const files = imageFiles(event.dataTransfer);
        if (!files.length) return false;
        event.preventDefault();
        event.stopPropagation();
        addFiles(files);
        return true;
      }
    },
    onCreate: ({ editor: current }) => {
      current.storage.ideaImageStore.get = (id) => imagesRef.current[id] || null;
    },
    onUpdate: ({ editor: current }) => {
      current.storage.ideaImageStore.get = (id) => imagesRef.current[id] || null;
      onChangeRef.current({
        body: canonicalImageMarkdown(current.getMarkdown()),
        images: imagesRef.current
      });
    }
  });

  editorRef.current = editor;

  if (editor?.storage?.ideaImageStore) {
    editor.storage.ideaImageStore.get = (id) => imagesRef.current[id] || null;
  }

  async function addFiles(files) {
    const current = editorRef.current;
    if (!current) return;
    setError('');
    const next = { ...imagesRef.current };
    try {
      for (const file of files) {
        const image = await readImageFile(file);
        const id = createIdeaId();
        next[id] = image;
        imagesRef.current = next;
        current.chain().focus().setImage({ src: `idea-image:${id}`, alt: '' }).run();
      }
    } catch (err) {
      imagesRef.current = next;
      setError(err && err.message ? err.message : '图片读不出来');
    }
  }

  return (
    <div
      className="idea-markdown-wrap"
      onDragOver={(event) => {
        if (imageFiles(event.dataTransfer).length) event.preventDefault();
      }}
      onDrop={(event) => {
        const files = imageFiles(event.dataTransfer);
        if (!files.length) return;
        event.preventDefault();
        addFiles(files);
      }}
    >
      {error ? <p className="idea-image-missing">{error}</p> : null}
      <div className="idea-markdown">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
