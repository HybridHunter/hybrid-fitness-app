import { useLocalStorage } from "../../hooks/useLocalStorage";

/**
 * PlanAccessPicker — reusable "Access" radio + plan checkboxes section.
 *
 * Props:
 *   allowedPlanIds : string[]          – current restricted plan IDs (empty = all)
 *   onChange       : (ids: string[]) => void
 *   B              : theme object
 *   labelStyle?    : style for <label>
 */
export default function PlanAccessPicker({ allowedPlanIds = [], onChange, B, labelStyle }) {
  const [plans] = useLocalStorage("hf_plans", []);
  const isRestricted = allowedPlanIds.length > 0;

  const lbl = labelStyle || { fontSize: 12, fontWeight: 600, color: B.muted, marginBottom: 4, display: "block" };

  return (
    <div>
      <label style={lbl}>Access</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: B.text, cursor: "pointer" }}>
          <input
            type="radio"
            name="planAccess"
            checked={!isRestricted}
            onChange={() => onChange([])}
          />
          All clients
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: B.text, cursor: "pointer" }}>
          <input
            type="radio"
            name="planAccess"
            checked={isRestricted}
            onChange={() => onChange(plans.length > 0 ? [plans[0].id] : ["__placeholder"])}
          />
          Specific plans only
        </label>
      </div>

      {isRestricted && (
        <div style={{ marginTop: 8, marginLeft: 24, display: "flex", flexDirection: "column", gap: 4 }}>
          {plans.length === 0 ? (
            <span style={{ fontSize: 12, color: B.muted, fontStyle: "italic" }}>No plans created yet. Go to Settings to add membership plans.</span>
          ) : (
            plans.map((plan) => {
              const checked = allowedPlanIds.includes(plan.id);
              return (
                <label key={plan.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: B.text, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = checked
                        ? allowedPlanIds.filter((id) => id !== plan.id)
                        : [...allowedPlanIds, plan.id];
                      onChange(next.length === 0 ? [] : next);
                    }}
                  />
                  {plan.name || plan.title || plan.id}
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/**
 * PlanLockBadge — small inline badge showing lock + plan names for restricted items.
 */
export function PlanLockBadge({ allowedPlanIds, B }) {
  const [plans] = useLocalStorage("hf_plans", []);
  if (!allowedPlanIds || allowedPlanIds.length === 0) return null;

  const names = allowedPlanIds
    .map((id) => {
      const p = plans.find((pl) => pl.id === id);
      return p ? (p.name || p.title || id) : null;
    })
    .filter(Boolean);

  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
        background: (B.orange || "#f59e0b") + "22",
        color: B.orange || "#f59e0b",
      }}
      title={`Restricted to: ${names.join(", ")}`}
    >
      {"\uD83D\uDD12"} {names.length > 0 ? names.join(", ") : "Plan-locked"}
    </span>
  );
}
