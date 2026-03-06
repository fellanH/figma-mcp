import { Toolbar } from "./components/Toolbar";
import { NodeTree } from "./components/NodeTree";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { HtmlPreview } from "./components/HtmlPreview";
import { RawJsonView } from "./components/RawJsonView";

export default function App() {
  return (
    <div className="h-screen flex flex-col">
      <Toolbar />
      <div className="flex-1 flex overflow-hidden">
        {/* Panel 1: Node Tree */}
        <div className="w-[260px] flex-none border-r border-border overflow-hidden">
          <NodeTree />
        </div>
        {/* Panel 2: Properties Inspector */}
        <div className="w-[340px] flex-none border-r border-border overflow-hidden">
          <PropertiesPanel />
        </div>
        {/* Panel 3: HTML Preview */}
        <div className="flex-1 overflow-hidden">
          <HtmlPreview />
        </div>
      </div>
      {/* Bottom: Raw JSON */}
      <RawJsonView />
    </div>
  );
}
