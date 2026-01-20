import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Bold, Italic, Underline, List, ListOrdered, Link, RotateCcw } from 'lucide-react';

interface SimpleEditorProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
}

export interface SimpleEditorHandle {
    insertAtCursor: (text: string) => void;
}

const SimpleEditor = forwardRef<SimpleEditorHandle, SimpleEditorProps>(({ value, onChange, className, placeholder }, ref) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [isFocused, setIsFocused] = useState(false);

    // Sync external value to internal contentEditable
    // We only update if the new value is significantly different to avoid cursor jumping
    useEffect(() => {
        if (editorRef.current && value !== editorRef.current.innerHTML) {
            // Only update if not focused to prevent overwriting user typing
            // OR if the value is completely different (e.g. initial load)
            if (!isFocused || editorRef.current.innerHTML === '') {
                editorRef.current.innerHTML = value;
            }
        }
    }, [value]);

    useImperativeHandle(ref, () => ({
        insertAtCursor: (text: string) => {
            if (!editorRef.current) return;
            editorRef.current.focus();

            // Modern way to insert text at cursor
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);

                // Check if selection is inside editor
                if (editorRef.current.contains(range.commonAncestorContainer)) {
                    range.deleteContents();
                    const textNode = document.createTextNode(text);
                    range.insertNode(textNode);

                    // Move cursor after text
                    range.setStartAfter(textNode);
                    range.setEndAfter(textNode);
                    selection.removeAllRanges();
                    selection.addRange(range);

                    // Trigger change
                    handleInput();
                } else {
                    // Fallback: append to end if focus is lost
                    editorRef.current.innerHTML += text;
                    handleInput();
                }
            } else {
                // Fallback: append to end
                editorRef.current.innerHTML += text;
                handleInput();
            }
        }
    }));

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const execCommand = (command: string, value: string | undefined = undefined) => {
        document.execCommand(command, false, value);
        editorRef.current?.focus();
    };

    return (
        <div className={`border rounded-lg overflow-hidden flex flex-col bg-white ${isFocused ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-300'} ${className}`}>
            {/* Toolbar */}
            <div className="bg-gray-50 border-b border-gray-200 p-2 flex gap-1 flex-wrap">
                <ToolbarButton onClick={() => execCommand('bold')} icon={<Bold size={16} />} tooltip="Bold" />
                <ToolbarButton onClick={() => execCommand('italic')} icon={<Italic size={16} />} tooltip="Italic" />
                <ToolbarButton onClick={() => execCommand('underline')} icon={<Underline size={16} />} tooltip="Underline" />
                <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
                <ToolbarButton onClick={() => execCommand('insertOrderedList')} icon={<ListOrdered size={16} />} tooltip="Ordered List" />
                <ToolbarButton onClick={() => execCommand('insertUnorderedList')} icon={<List size={16} />} tooltip="Bullet List" />
                <div className="w-px h-6 bg-gray-300 mx-1 self-center" />
                <ToolbarButton onClick={() => {
                    const url = prompt('Enter URL:');
                    if (url) execCommand('createLink', url);
                }} icon={<Link size={16} />} tooltip="Link" />
                <ToolbarButton onClick={() => execCommand('removeFormat')} icon={<RotateCcw size={16} />} tooltip="Clear Format" />
            </div>

            {/* Editor Area */}
            <div
                ref={editorRef}
                contentEditable
                className="flex-1 p-4 outline-none prose max-w-none overflow-y-auto"
                onInput={handleInput}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                style={{ minHeight: '150px' }}
                dangerouslySetInnerHTML={{ __html: value }}
            />
            {value === '' && !isFocused && (
                <div className="absolute p-4 text-gray-400 pointer-events-none">
                    {placeholder}
                </div>
            )}
        </div>
    );
});

const ToolbarButton = ({ onClick, icon, tooltip }: { onClick: () => void, icon: React.ReactNode, tooltip: string }) => (
    <button
        type="button"
        onMouseDown={(e) => {
            e.preventDefault(); // Prevent losing focus from editor
            onClick();
        }}
        className="p-1.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900 transition-colors"
        title={tooltip}
    >
        {icon}
    </button>
);

export default SimpleEditor;
