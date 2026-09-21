import { MessageSquare } from "lucide-react";
import type { AssessmentComment } from "@/data/assessmentStore";

export function CommentList({ comments, title = "Comments" }: { comments: AssessmentComment[]; title?: string }) {
  if (comments.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" /> {title}
      </h3>
      <ul className="max-h-40 space-y-1.5 overflow-y-auto">
        {comments.map((c) => (
          <li key={c.id} className="rounded-md bg-muted/40 p-2.5 text-xs">
            <p className="font-medium text-foreground">
              {c.authorName} <span className="font-normal text-muted-foreground">· {c.authorRole}</span>
            </p>
            <p className="mt-0.5 text-muted-foreground">{c.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
