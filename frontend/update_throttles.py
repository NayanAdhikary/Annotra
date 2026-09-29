import os

def update_vertex():
    with open('src/components/canvas/VertexHandles.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Import
    if 'useRafThrottle' not in content:
        content = content.replace('import React, { useRef } from \'react\';', 'import React, { useRef } from \'react\';\nimport { useRafThrottle } from \'../../hooks/useRafThrottle\';')

    # Hook init
    if 'rafSetVertex' not in content:
        content = content.replace('const setVertex = (i: number, x: number, y: number) => {', 
'''const setVertex = (i: number, x: number, y: number) => {
    const next = [...pts];
    next[i * 2] = x;
    next[i * 2 + 1] = y;
    replaceAnnotation(annotation.id, { points: next });
  };
  const rafSetVertex = useRafThrottle((i: number, x: number, y: number) => {
    setVertex(i, x, y);
  });
  
  // original setVertex signature change hook logic to avoid redeclaring:''')
        content = content.replace('''  // original setVertex signature change hook logic to avoid redeclaring:
    const next = [...pts];
    next[i * 2] = x;
    next[i * 2 + 1] = y;
    replaceAnnotation(annotation.id, { points: next });
  };''', '')

    # onDragMove usage
    content = content.replace('''            onDragMove={(e) => {
              setVertex(i, e.target.x(), e.target.y());
            }}''', '''            onDragMove={(e) => {
              rafSetVertex(i, e.target.x(), e.target.y());
            }}''')

    with open('src/components/canvas/VertexHandles.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

def update_rect():
    with open('src/components/canvas/Shapes/RectShape.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    if 'useRafThrottle' not in content:
        content = content.replace('import React, { useRef } from \'react\';', 'import React, { useRef } from \'react\';\nimport { useRafThrottle } from \'../../../hooks/useRafThrottle\';')

    # We need to find setVertex logic if any, wait, RectShape onDragMove calls replaceAnnotation maybe?
    # Let's search and replace carefully. Actually, let's just use Python script to print RectShape and I'll see it first.
    pass

update_vertex()
