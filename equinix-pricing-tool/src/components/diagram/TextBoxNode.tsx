import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Handle, Position, type NodeProps, NodeResizer } from '@xyflow/react';
import { useConfigStore } from '@/store/configStore';

interface TextBoxNodeData {
  textBoxId: string;
  text: string;
  tbWidth: number;
  tbHeight: number;
  [key: string]: unknown;
}

export const TextBoxNode = memo(function TextBoxNode({ data, selected }: NodeProps) {
  const { textBoxId, text, tbWidth, tbHeight } = data as TextBoxNodeData;
  const updateTextBox = useConfigStore((s) => s.updateTextBox);
  const removeTextBox = useConfigStore((s) => s.removeTextBox);

  const [editing, setEditing] = useState(false);
  const [localText, setLocalText] = useState(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLocalText(text);
  }, [text]);

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editing]);

  const handleBlur = useCallback(() => {
    setEditing(false);
    updateTextBox(textBoxId, { text: localText });
  }, [textBoxId, localText, updateTextBox]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditing(false);
      updateTextBox(textBoxId, { text: localText });
    }
  }, [textBoxId, localText, updateTextBox]);

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={30}
        handleStyle={{ width: 8, height: 8 }}
        lineStyle={{ borderColor: '#33A85C' }}
        onResize={(_event, params) => {
          updateTextBox(textBoxId, { width: params.width, height: params.height });
        }}
      />
      <div
        className="w-full h-full border border-dashed border-gray-400 rounded bg-white/80 flex items-start relative group"
        style={{ width: tbWidth, height: tbHeight }}
        onDoubleClick={handleDoubleClick}
      >
        {editing ? (
          <textarea
            ref={textareaRef}
            value={localText}
            onChange={(e) => setLocalText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full h-full resize-none bg-transparent text-[10px] text-gray-800 p-1.5 focus:outline-none"
            style={{ fontFamily: 'Arial, sans-serif' }}
          />
        ) : (
          <p
            className="text-[10px] text-gray-800 p-1.5 whitespace-pre-wrap break-words w-full"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            {text || 'Double-click to edit'}
          </p>
        )}
        {/* Delete button - visible on hover */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeTextBox(textBoxId);
          }}
          className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove text box"
        >
          ×
        </button>
      </div>
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0 !w-0 !h-0" />
      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0 !w-0 !h-0" />
    </>
  );
});
