import fs from 'fs';
import path from 'path';

// Function to generate a large scenario
function generateScenario(id, name, numNodes, seed) {
    const serviceTypes = ['power', 'water', 'healthcare', 'transport', 'communications'];
    const nodes = [];
    const edges = [];
    
    // Generate nodes
    for (let i = 0; i < numNodes; i++) {
        nodes.push({
            id: `node-${id}-${i}`,
            name: `Facility ${i} (${id})`,
            service_type: serviceTypes[Math.floor(Math.random() * serviceTypes.length)],
            failure_threshold: 0.5 + Math.random() * 0.4
        });
    }

    // Generate edges
    for (let i = 1; i < numNodes; i++) {
        // Connect to a previous node to form a DAG
        const upstreamIdx = Math.floor(Math.random() * i);
        edges.push({
            upstream_id: `node-${id}-${upstreamIdx}`,
            dependent_id: `node-${id}-${i}`,
            weight: 0.3 + Math.random() * 0.7
        });
        // Sometimes add an alternative path
        if (Math.random() > 0.5 && i > 1) {
            const altIdx = Math.floor(Math.random() * (i - 1));
            if (altIdx !== upstreamIdx) {
                edges.push({
                    upstream_id: `node-${id}-${altIdx}`,
                    dependent_id: `node-${id}-${i}`,
                    weight: 0.2 + Math.random() * 0.6
                });
            }
        }
    }

    const initial_disruptions = [`node-${id}-0`];
    
    const snapshots = [];
    const events = [];
    
    // Initial state
    let currentStates = {};
    for (let i = 0; i < numNodes; i++) {
        currentStates[`node-${id}-${i}`] = 'operational';
    }
    
    // Fail the first node
    currentStates[`node-${id}-0`] = 'failed';
    snapshots.push({
        time: 0,
        node_states: { ...currentStates }
    });
    events.push({
        time: 0,
        node_id: `node-${id}-0`,
        previous_state: 'operational',
        next_state: 'failed',
        cause: 'initial_shock',
        source_node_id: null
    });

    let time = 1;
    // Simple cascade simulation
    let changed = true;
    while (changed && time < 10) {
        changed = false;
        const newStates = { ...currentStates };
        for (let i = 1; i < numNodes; i++) {
            const nodeId = `node-${id}-${i}`;
            if (currentStates[nodeId] === 'failed') continue;
            
            // Check upstream
            const incomingEdges = edges.filter(e => e.dependent_id === nodeId);
            let failedWeight = 0;
            let totalWeight = 0;
            let upstreamFailId = null;
            
            for (const edge of incomingEdges) {
                totalWeight += edge.weight;
                if (currentStates[edge.upstream_id] !== 'operational') {
                    failedWeight += edge.weight;
                    if (!upstreamFailId) upstreamFailId = edge.upstream_id;
                }
            }
            
            const nodeThreshold = nodes[i].failure_threshold;
            let nextState = currentStates[nodeId];
            
            if (totalWeight > 0) {
                const failRatio = failedWeight / totalWeight;
                if (failRatio > nodeThreshold) {
                    nextState = 'failed';
                } else if (failRatio > nodeThreshold * 0.5) {
                    nextState = 'degraded';
                }
            }
            
            if (nextState !== currentStates[nodeId]) {
                newStates[nodeId] = nextState;
                events.push({
                    time,
                    node_id: nodeId,
                    previous_state: currentStates[nodeId],
                    next_state: nextState,
                    cause: nextState === 'failed' ? 'threshold_exceeded' : 'supply_drop',
                    source_node_id: upstreamFailId
                });
                changed = true;
            }
        }
        
        currentStates = newStates;
        snapshots.push({
            time,
            node_states: { ...currentStates }
        });
        time++;
    }

    // Recovery phase for scenario 6
    if (id === 'rolling-recovery') {
        for (let t = 0; t < 5; t++) {
            let recovered = false;
            const newStates = { ...currentStates };
            for (let i = 0; i < numNodes; i++) {
                const nodeId = `node-${id}-${i}`;
                if (currentStates[nodeId] !== 'operational') {
                    // Check if upstream is operational
                    const incomingEdges = edges.filter(e => e.dependent_id === nodeId);
                    let allUpstreamOperational = true;
                    for (const edge of incomingEdges) {
                        if (currentStates[edge.upstream_id] !== 'operational') {
                            allUpstreamOperational = false;
                        }
                    }
                    if (allUpstreamOperational || incomingEdges.length === 0) {
                        newStates[nodeId] = 'operational';
                        events.push({
                            time,
                            node_id: nodeId,
                            previous_state: currentStates[nodeId],
                            next_state: 'operational',
                            cause: 'rated_output_achieved',
                            source_node_id: null
                        });
                        recovered = true;
                    }
                }
            }
            currentStates = newStates;
            snapshots.push({
                time,
                node_states: { ...currentStates }
            });
            time++;
            if (!recovered) break;
        }
    }

    return {
        scenario: {
            id,
            name,
            description: `Generated large scenario with ${numNodes} nodes`,
            graph_id: 'large-graph-v1',
            nodes,
            edges,
            initial_disruptions
        },
        result: {
            scenario_id: id,
            seed,
            start_time: 0,
            end_time: time - 1,
            snapshots,
            events
        }
    };
}

const scenario5 = generateScenario('city-wide-blackout', 'City-Wide Blackout Event', 45, 9001);
const scenario6 = generateScenario('rolling-recovery', 'Rolling Recovery', 40, 9002);

// We need to inject these into sampleScenarios.ts
const filePath = path.join(process.cwd(), 'src/data/sampleScenarios.ts');
let content = fs.readFileSync(filePath, 'utf-8');

// Find the last closing brace of SAMPLE_SCENARIOS
const objStr = `
  'city-wide-blackout': ${JSON.stringify(scenario5, null, 2)},
  'rolling-recovery': ${JSON.stringify(scenario6, null, 2)}
};`;

content = content.replace(/};\s*$/, objStr);

fs.writeFileSync(filePath, content);
console.log('Successfully added 2 large scenarios to sampleScenarios.ts');
