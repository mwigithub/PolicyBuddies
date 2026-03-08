"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface ClarificationDialogProps {
  open: boolean;
  questions: string[];
  onConfirm: (answer: string) => void;
  onCancel: () => void;
}

export function ClarificationDialog({
  open,
  questions,
  onConfirm,
  onCancel,
}: ClarificationDialogProps) {
  const [selected, setSelected] = useState<string>("");

  const primaryQuestion = questions[0] ?? "Could you clarify your question?";
  const options = questions.length > 1 ? questions.slice(1) : questions;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Need a bit more info</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <p className="text-sm text-gray-700 mb-4">{primaryQuestion}</p>

          {options.length > 0 ? (
            <RadioGroup value={selected} onValueChange={setSelected} className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <RadioGroupItem value={opt} id={`opt-${i}`} />
                  <Label htmlFor={`opt-${i}`} className="text-sm font-normal cursor-pointer">
                    {opt}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          ) : (
            <p className="text-xs text-gray-400">Type a follow-up to clarify.</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={options.length > 0 && !selected}
            onClick={() => onConfirm(selected || primaryQuestion)}
            style={{ backgroundColor: "var(--pb-primary)" }}
            className="text-white"
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
