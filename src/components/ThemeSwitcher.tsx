import { THEMES, type ThemeId } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeSwitcher({
  theme,
  onChange,
}: {
  theme: ThemeId;
  onChange: (id: ThemeId) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-xl border border-border bg-surface-2/40 p-1">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          aria-label={`${t.label} theme`}
          aria-pressed={theme === t.id}
          title={t.label}
          className={cn(
            "size-6 rounded-lg border transition-colors",
            theme === t.id
              ? "border-primary"
              : "border-border hover:border-border-strong",
          )}
          style={{
            background: `linear-gradient(135deg, ${t.swatch[1]} 0 50%, ${t.swatch[2]} 50% 100%)`,
          }}
        />
      ))}
    </div>
  );
}
