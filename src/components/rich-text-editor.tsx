import { useState } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import TextAlign from "@tiptap/extension-text-align"
import Placeholder from "@tiptap/extension-placeholder"
import {
  TextB,
  TextItalic,
  TextUnderline,
  ListBullets,
  ListNumbers,
  TextHOne,
  TextHTwo,
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
} from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Start writing…",
}: RichTextEditorProps) {
  // Tick state forces toolbar re-render when cursor moves into different formatting
  const [, setTick] = useState(0)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2] },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    onSelectionUpdate: () => setTick((t) => t + 1),
  })

  if (!editor) return null

  return (
    <div className="rounded-xl border border-border/70 bg-background/50">
      <div className="flex flex-wrap items-center gap-1 border-b border-border/70 p-1.5">
        <ToolbarBtn
          icon={<TextHOne className="size-3.5" />}
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
        />
        <ToolbarBtn
          icon={<TextHTwo className="size-3.5" />}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolbarBtn
          icon={<TextB className="size-3.5" />}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarBtn
          icon={<TextItalic className="size-3.5" />}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarBtn
          icon={<TextUnderline className="size-3.5" />}
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolbarBtn
          icon={<ListBullets className="size-3.5" />}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarBtn
          icon={<ListNumbers className="size-3.5" />}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <Separator orientation="vertical" className="mx-1 h-5" />
        <ToolbarBtn
          icon={<TextAlignLeft className="size-3.5" />}
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        />
        <ToolbarBtn
          icon={<TextAlignCenter className="size-3.5" />}
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        />
        <ToolbarBtn
          icon={<TextAlignRight className="size-3.5" />}
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        />
      </div>
      <EditorContent
        editor={editor}
        className={cn(
          "max-w-none px-3 py-2 text-sm",
          "[&_.tiptap]:min-h-[10rem] [&_.tiptap]:outline-none",
          "[&_.tiptap_h1]:text-2xl [&_.tiptap_h1]:font-bold [&_.tiptap_h1]:mt-4 [&_.tiptap_h1]:mb-2",
          "[&_.tiptap_h2]:text-xl [&_.tiptap_h2]:font-semibold [&_.tiptap_h2]:mt-3 [&_.tiptap_h2]:mb-1.5",
          "[&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5 [&_.tiptap_ul]:my-2",
          "[&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5 [&_.tiptap_ol]:my-2",
          "[&_.tiptap_li]:my-0.5",
          "[&_.tiptap_p]:my-1",
          "[&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.tiptap_p.is-editor-empty:first-child::before]:float-left [&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none [&_.tiptap_p.is-editor-empty:first-child::before]:h-0"
        )}
      />
    </div>
  )
}

/** Returns plain text length from an HTML string (for validation) */
export function getTextLength(html: string): number {
  const tmp = document.createElement("div")
  tmp.innerHTML = html
  return (tmp.textContent || "").trim().length
}

function ToolbarBtn({
  icon,
  active,
  onClick,
}: {
  icon: React.ReactNode
  active?: boolean
  onClick: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      className={cn("size-7", active && "bg-accent text-accent-foreground")}
      onClick={onClick}
    >
      {icon}
    </Button>
  )
}
