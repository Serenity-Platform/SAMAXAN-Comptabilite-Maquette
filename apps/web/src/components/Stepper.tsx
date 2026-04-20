import { theme } from "../lib/theme";

type Step = {
  index: number;
  label: string;
};

type Props = {
  current: number; // 1-based
  steps: Step[];
};

export function Stepper({ current, steps }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28, flexWrap: "wrap" }}>
      {steps.map((step, i) => {
        const isDone = step.index < current;
        const isActive = step.index === current;
        const color = isActive
          ? theme.color.primary
          : isDone
            ? theme.color.primary
            : theme.color.textFaint;
        const bg = isActive ? theme.color.primary : isDone ? theme.color.primary : "white";
        const textColor = isActive || isDone ? "white" : theme.color.textFaint;
        return (
          <div key={step.index} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                border: `2px solid ${color}`,
                background: bg,
                color: textColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: theme.fontSize.sm,
                fontWeight: 700,
              }}
            >
              {isDone ? "✓" : step.index}
            </div>
            <span
              style={{
                fontSize: theme.fontSize.sm,
                color: isActive ? theme.color.text : theme.color.textSoft,
                fontWeight: isActive ? 600 : 500,
              }}
            >
              {step.label}
            </span>
            {i < steps.length - 1 && (
              <span style={{ color: theme.color.border, margin: "0 4px" }}>—</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
