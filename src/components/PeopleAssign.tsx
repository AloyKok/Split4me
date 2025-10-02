"use client";

import { useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Person } from "@/types";

interface PeopleAssignProps {
  persons: Person[];
  onAdd: () => void;
  onRename: (personId: string, name: string) => void;
  onRemove: (personId: string) => void;
  onWeightChange: (personId: string, weight: number) => void;
  showWeights: boolean;
  onToggleWeights: () => void;
  canEditWeights: boolean;
}

export const PeopleAssign = ({
  persons,
  onAdd,
  onRename,
  onRemove,
  onWeightChange,
  showWeights,
  onToggleWeights,
  canEditWeights,
}: PeopleAssignProps) => {
  const [renameTarget, setRenameTarget] = useState<Person | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const openRename = (person: Person) => {
    setRenameTarget(person);
    setRenameValue(person.name);
  };

  const confirmRename = () => {
    if (!renameTarget) return;
    const next = renameValue.trim();
    if (next) onRename(renameTarget.id, next);
    setRenameTarget(null);
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">People</h2>
          <p className="text-xs text-muted-foreground">Add friends and edit their names or weights for splitting later.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <Button variant="outline" size="sm" onClick={onAdd} className="w-full gap-2 sm:w-auto">
            <Plus className="h-4 w-4" /> Add person
          </Button>
          {canEditWeights ? (
            <Button variant="ghost" size="sm" onClick={onToggleWeights} className="w-full sm:w-auto">
              {showWeights ? "Hide weighted split" : "Weighted split"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {persons.map((person) => (
          <div key={person.id} className="flex items-center gap-1">
            <span
              aria-hidden
              className="flex h-9 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium"
              style={{ borderColor: person.color }}
            >
              {person.name}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openRename(person)}>Rename</DropdownMenuItem>
                <DropdownMenuItem
                  disabled={persons.length <= 1}
                  onClick={() => onRemove(person.id)}
                  className="text-destructive focus:text-destructive"
                >
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>

      {canEditWeights && showWeights && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {persons.map((person) => (
            <div key={person.id} className="rounded-xl border border-border p-3">
              <Label htmlFor={`weight-${person.id}`} className="text-sm font-medium">
                {person.name}
              </Label>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  id={`weight-${person.id}`}
                  type="number"
                  inputMode="decimal"
                  min={0.1}
                  step="0.1"
                  value={person.weight.toString()}
                  onChange={(event) => onWeightChange(person.id, Number.parseFloat(event.target.value || "1"))}
                />
                <span className="text-xs text-muted-foreground">Weight</span>
              </div>
            </div>
          ))}
          <p className="col-span-full text-xs text-muted-foreground">
            Weights only affect the Total Only tab. Leave everyone at 1 for an even split.
          </p>
        </div>
      )}

      <Dialog open={Boolean(renameTarget)} onOpenChange={() => setRenameTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename person</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="rename-input">Name</Label>
            <Input
              id="rename-input"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={confirmRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
