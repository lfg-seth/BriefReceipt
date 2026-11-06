import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CheckSquare,
  ChevronRight,
  CloudSun,
  FolderGit2,
  GripVertical,
  MapPin,
  Newspaper,
  ChartNoAxesCombined,
  Sparkles,
} from "lucide-react";
import { BLOCK_META, type BlockId, type Config } from "../types";
import "./editor.css";

const icons = {
  summary: Sparkles,
  weather: CloudSun,
  calendar: CalendarDays,
  tasks: CheckSquare,
  news: Newspaper,
  events: MapPin,
  markets: ChartNoAxesCombined,
  projects: FolderGit2,
};
type Props = {
  config: Config;
  onChange: (config: Config) => void;
  selected: BlockId;
  onSelect: (id: BlockId) => void;
};

export function BlockEditor({ config, onChange, selected, onSelect }: Props) {
  const [dragging, setDragging] = useState<BlockId | null>(null);
  const [over, setOver] = useState<BlockId | null>(null);
  const move = (from: number, to: number) => {
    if (to < 0 || to >= config.blocks.length || from === to) return;
    const blocks = [...config.blocks];
    blocks.splice(to, 0, blocks.splice(from, 1)[0]);
    onChange({ ...config, blocks });
  };
  return (
    <section className="block-editor" aria-label="Briefing blocks">
      <div className="editor-eyebrow">
        <span>Your briefing</span>
        <span>
          {config.blocks.filter((b) => b.enabled).length} of{" "}
          {config.blocks.length} blocks
        </span>
      </div>
      <div className="block-list">
        {config.blocks.map((block, index) => {
          const Icon = icons[block.id];
          return (
            <div
              key={block.id}
              className={`block-row ${selected === block.id ? "is-selected" : ""} ${!block.enabled ? "is-disabled" : ""} ${over === block.id && dragging !== block.id ? "is-drop-target" : ""} ${dragging === block.id ? "is-dragging" : ""}`}
              draggable
              onDragStart={(e) => {
                setDragging(block.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", block.id);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOver(block.id);
              }}
              onDragLeave={() => setOver(null)}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = config.blocks.findIndex(
                  (b) => b.id === e.dataTransfer.getData("text/plain"),
                );
                if (from >= 0) move(from, index);
                setDragging(null);
                setOver(null);
              }}
            >
              <span className="block-grip" title="Drag to reorder">
                <GripVertical size={14} />
              </span>
              <button
                className="block-select"
                aria-label={`Configure ${BLOCK_META[block.id].title}`}
                aria-pressed={selected === block.id}
                onClick={() => onSelect(block.id)}
              >
                <span className="block-icon">
                  <Icon size={18} strokeWidth={1.6} />
                </span>
                <span className="block-copy">
                  <strong>{BLOCK_META[block.id].title}</strong>
                  <small>{BLOCK_META[block.id].subtitle}</small>
                </span>
                <ChevronRight size={14} className="block-chevron" />
              </button>
              <div className="block-moves">
                <button
                  aria-label={`Move ${BLOCK_META[block.id].title} up`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  aria-label={`Move ${BLOCK_META[block.id].title} down`}
                  disabled={index === config.blocks.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown size={12} />
                </button>
              </div>
              <button
                className="editor-switch"
                role="switch"
                aria-checked={block.enabled}
                aria-label={`Enable ${BLOCK_META[block.id].title}`}
                onClick={() =>
                  onChange({
                    ...config,
                    blocks: config.blocks.map((b) =>
                      b.id === block.id ? { ...b, enabled: !b.enabled } : b,
                    ),
                  })
                }
              >
                <span />
              </button>
            </div>
          );
        })}
      </div>
      <p className="editor-help reorder-help">
        <GripVertical size={13} /> Drag to arrange. Use the arrows for a finer
        touch.
      </p>
    </section>
  );
}
