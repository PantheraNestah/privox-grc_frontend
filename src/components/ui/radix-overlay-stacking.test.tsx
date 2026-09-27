import { useState } from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Regression for the org-structure freeze (issue #16).
 *
 * Opening a controlled Dialog from a DropdownMenuItem used to leave
 * `document.body.style.pointerEvents = "none"`, freezing the whole page. The
 * root cause was two copies of `@radix-ui/react-dismissable-layer` (pulled in by
 * different Radix packages) keeping separate layer contexts, so the Dialog
 * captured the DropdownMenu's temporary `pointer-events: none` as its own
 * "original" value and restored it on close.
 */
const Harness = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={() => setOpen(true)}>Edit</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Edit</DialogTitle>
          <button id="dialog-close" onClick={() => setOpen(false)}>
            Close
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
};

const bodyPointerEvents = () => document.body.style.pointerEvents;

describe("Radix overlay stacking", () => {
  it("restores body pointer-events after closing a Dialog opened from a DropdownMenu", () => {
    render(<Harness />);

    const trigger = document.querySelector('[aria-haspopup="menu"]') as HTMLElement;
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const item = document.querySelector('[role="menuitem"]') as HTMLElement;
    fireEvent.click(item);

    // The Dialog is now open and interactions outside it are blocked.
    const close = document.getElementById("dialog-close") as HTMLElement;
    expect(close).toBeTruthy();
    expect(document.body.style.pointerEvents).toBe("none");

    fireEvent.click(close);

    // Once the last layer is gone, the body must be interactive again.
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(bodyPointerEvents()).not.toBe("none");
  });
});
