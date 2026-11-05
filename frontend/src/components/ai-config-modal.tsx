"use client";

import { useState } from "react";
import { Sparkles, Key, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface AIConfigModalProps {
  apiKeys: string[];
  onSaveKeys: (keys: string[]) => void;
  selectedModel: string;
  onSaveModel: (model: string) => void;
}

export function AIConfigModal({
  apiKeys,
  onSaveKeys,
  selectedModel,
  onSaveModel,
}: AIConfigModalProps) {
  const [keysInput, setKeysInput] = useState(apiKeys.join("\n"));
  const [modelInput, setModelInput] = useState(selectedModel);
  const [isOpen, setIsOpen] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = keysInput
      .split(/[\n,]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    onSaveKeys(parsed);
    onSaveModel(modelInput);
    setIsOpen(false);
  };

  const keyCount = keysInput
    .split(/[\n,]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0).length;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Sparkles className="size-3.5" />
            <span>AI Settings</span>
            {keyCount > 0 && (
              <span className="px-1.5 py-0.2 bg-muted text-muted-foreground rounded text-[10px] font-mono">
                {keyCount} {keyCount === 1 ? "Key" : "Keys"}
              </span>
            )}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="size-4 text-foreground" />
            AI Intelligence & Key Configuration
          </DialogTitle>
          <DialogDescription>
            Configure access keys for the schema matching engine. The platform automatically cycles through multiple keys in a round-robin rotation for high reliability.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="api-keys" className="text-xs font-semibold">
                Access Keys (Round-Robin Pool)
              </Label>
              <span className="text-[11px] text-muted-foreground font-mono">
                {keyCount} keys active
              </span>
            </div>
            <Textarea
              id="api-keys"
              rows={4}
              placeholder="key_1...&#10;key_2...&#10;key_3..."
              value={keysInput}
              onChange={(e) => setKeysInput(e.target.value)}
              className="text-xs font-mono bg-card"
            />
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Info className="size-3 shrink-0" />
              Enter one key per line or separate with commas. If left empty, server defaults will be used.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="model-select" className="text-xs font-semibold">
              Matching Intelligence Engine
            </Label>
            <select
              id="model-select"
              value={modelInput}
              onChange={(e) => setModelInput(e.target.value)}
              className="w-full h-8 rounded-md border border-input bg-card px-2.5 text-xs text-foreground outline-none focus:border-ring"
            >
              <option value="openai/gpt-oss-120b">
                High-Precision Neural Matcher (Recommended)
              </option>
              <option value="openai/gpt-oss-20b">
                Ultra-Fast Semantic Matcher
              </option>
              <option value="qwen/qwen3.6-27b">
                Deep Multilingual Reasoning Engine
              </option>
              <option value="groq/compound">
                Compound Multi-Attribute Engine
              </option>
            </select>
          </div>

          <DialogFooter>
            <DialogClose render={<Button variant="outline" type="button">Cancel</Button>} />
            <Button type="submit" className="gap-1.5">
              <Check className="size-3.5" />
              Save Configuration
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
