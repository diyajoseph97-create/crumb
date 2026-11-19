// One combined list of ingredients for the recipes you've added to it.
import { useEffect, useState } from "react";
import { clearList, combined, getList, listAsText, onListChange, removeFromList, removeItem, toggleChecked } from "@/lib/shopping";
import { Icon } from "./ui";

export function useShoppingCount() {
  const [n, setN] = useState(getList().recipes.length);
  useEffect(() => {
    const off = onListChange(() => setN(getList().recipes.length));
    return () => { off(); };
  }, []);
  return n;
}

export function ShoppingList({ onClose, onOpen }: { onClose: () => void; onOpen: (id: string) => void }) {
  const [list, setList] = useState(getList());
  const [note, setNote] = useState<string | null>(null);
  useEffect(() => {
    const off = onListChange(() => setList(getList()));
    return () => { off(); };
  }, []);
  const items = combined(list);
  const left = items.filter((i) => !list.checked.includes(i.key)).length;

  async function copy() {
    const text = listAsText(list);
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string }) => Promise<void> };
    if (nav.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      await nav.share({ title: "Shopping list", text }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setNote("List copied. Paste it into Notes, WhatsApp or anywhere.");
    } catch {
      setNote("Couldn't copy automatically. Select the items and copy them yourself.");
    }
  }

  return (
    <div className="shop">
      <div className="sheet-head">
        <span className="sheet-grip" aria-hidden="true" />
        <h2 className="h-display h-sm">Shopping list</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
      </div>
      <div className="sheet-body">
        {list.recipes.length === 0 ? (
          <p className="muted shop-empty">Nothing on your list yet. Open a recipe and tap the cart next to <strong>Ingredients</strong>, and its ingredients land here, added up across recipes.</p>
        ) : (
          <>
            <div className="shop-recipes">
              {list.recipes.map((r) => (
                <span key={r.id} className="coll-chip">
                  <button className="shop-recipe-name" onClick={() => onOpen(r.id)}>{r.name}{r.servings ? ` · ${r.servings}` : ""}</button>
                  <button aria-label={`Remove ${r.name} from the list`} onClick={() => removeFromList(r.id)}><Icon name="x" size={11} /></button>
                </span>
              ))}
            </div>
            <p className="result-count">{left} of {items.length} left to buy · tick what you've bought, × what you already have</p>
            <ul className="shop-items">
              {items.map((i) => {
                const on = list.checked.includes(i.key);
                return (
                  <li key={i.key} className="shop-row">
                    <button className={`cook-ing ${on ? "on" : ""}`} aria-pressed={on} onClick={() => toggleChecked(i.key)}>
                      <span className="cook-check">{on && <Icon name="check" size={14} />}</span>
                      <span className="shop-amt">{i.amount}</span>
                      <span className="shop-name">{i.name}{i.from.length > 1 && <span className="muted small"> · {i.from.length} recipes</span>}</span>
                    </button>
                    <button className="icon-btn sm shop-x" onClick={() => removeItem(i.key)} aria-label={`I already have ${i.name}. Remove it`} title="I already have this"><Icon name="x" size={16} /></button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {note && <p className="form-ok" role="status">{note}</p>}
      </div>
      {list.recipes.length > 0 && (
        <div className="sheet-foot">
          <button className="btn btn-ghost" onClick={() => { clearList(); setNote(null); }}>Clear list</button>
          <button className="btn btn-primary" onClick={copy}><Icon name="share" size={16} /> Copy or share list</button>
        </div>
      )}
    </div>
  );
}
