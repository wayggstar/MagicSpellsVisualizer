import { Background, Controls, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export function FlowPanel({ flow, parsed, onSelectPath }) {
  return (
    <section className="panel flow-panel" aria-label="Spell graph">
      <div className="panel-strip">
        <span>Spell Graph</span>
      </div>
      <ReactFlow
        nodes={flow.nodes}
        edges={flow.edges}
        fitView
        onNodeClick={(_, node) => {
          if (node.data.kind === "call" && parsed?.[node.data.targetSpell]) {
            onSelectPath([node.data.targetSpell]);
            return;
          }

          onSelectPath(node.data.path);
        }}
      >
        <Background color="#3a414f" />
        <Controls />
      </ReactFlow>
    </section>
  );
}

