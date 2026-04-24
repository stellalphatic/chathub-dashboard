"use client";

import { useRef, useState, useTransition } from "react";
import { FileText, Type, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { createDocumentFromTextAction } from "@/lib/org-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export function AddDocumentForm({ orgSlug }: { orgSlug: string }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [pending, start] = useTransition();

  // File upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) {
      toast.error("File too large (max 25MB).");
      return;
    }
    setFile(f);
    if (!uploadTitle) setUploadTitle(f.name.replace(/\.[^.]+$/, ""));
  };

  const uploadFile = async () => {
    if (!file) return;
    if (!uploadTitle.trim()) {
      toast.error("Give the document a title first.");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("title", uploadTitle.trim());
      form.append("file", file);
      const res = await fetch(
        `/api/v1/documents?orgSlug=${encodeURIComponent(orgSlug)}`,
        { method: "POST", body: form },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        id?: string;
      };
      if (!res.ok) {
        toast.error(json.error ?? `Upload failed (${res.status})`);
      } else {
        toast.success("Queued for embedding.");
        setFile(null);
        setUploadTitle("");
        if (inputRef.current) inputRef.current.value = "";
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Tabs defaultValue="file">
      <TabsList>
        <TabsTrigger value="file">
          <Upload className="h-3.5 w-3.5" /> Upload file
        </TabsTrigger>
        <TabsTrigger value="text">
          <Type className="h-3.5 w-3.5" /> Paste text
        </TabsTrigger>
      </TabsList>

      <TabsContent value="file" className="space-y-4">
        <div>
          <Label>Title</Label>
          <Input
            className="mt-1"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
            placeholder="Shipping policy, product FAQ, …"
          />
        </div>

        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
            dragActive
              ? "border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.06)]"
              : "border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] hover:border-[rgb(var(--accent)/0.5)]"
          }`}
        >
          <Upload className="h-8 w-8 text-[rgb(var(--fg-muted))]" />
          <p className="text-sm font-medium text-[rgb(var(--fg))]">
            {file ? file.name : "Drop a file here, or click to pick"}
          </p>
          <p className="text-xs text-[rgb(var(--fg-subtle))]">
            PDF, DOCX, TXT · up to 25 MB
          </p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.docx,.txt,.md,application/pdf,text/plain"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {file ? (
          <div className="flex items-center justify-between rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-[rgb(var(--accent))]" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-[11px] text-[rgb(var(--fg-subtle))]">
                  {(file.size / 1024).toFixed(0)} KB · {file.type || "unknown"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="rounded-md p-1 text-[rgb(var(--fg-muted))] hover:bg-[rgb(var(--surface))]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <Button
          type="button"
          variant="gradient"
          disabled={!file || uploading}
          onClick={uploadFile}
        >
          {uploading ? "Uploading…" : "Upload & index"}
        </Button>
      </TabsContent>

      <TabsContent value="text" className="space-y-4">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await createDocumentFromTextAction({
                orgSlug,
                title,
                text,
              });
              if ("error" in res) {
                toast.error(res.error);
              } else {
                toast.success("Queued for embedding.");
                setTitle("");
                setText("");
              }
            });
          }}
        >
          <div>
            <Label>Title</Label>
            <Input
              className="mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Shipping policy"
            />
          </div>
          <div>
            <Label>Text</Label>
            <Textarea
              className="mt-1"
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste the content you want the bot to know…"
            />
          </div>
          <Button type="submit" variant="gradient" disabled={pending}>
            {pending ? "Queuing…" : "Add to knowledge base"}
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}
