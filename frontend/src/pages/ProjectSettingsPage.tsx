import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { projectsApi } from '../api/projects';
import { toolConfigApi, ToolConfig } from '../api/toolConfig';

const TOOLS = [
    { key: 'rectangle', label: 'Rectangle', icon: '▭' },
    { key: 'polygon', label: 'Polygon', icon: '⬡' },
    { key: 'polyline', label: 'Polyline', icon: '∿' },
    { key: 'points', label: 'Points', icon: '•' },
    { key: 'brush', label: 'Brush', icon: '🖌' },
    { key: 'eraser', label: 'Eraser', icon: '⌫' },
]

const Toggel: React.FC<{
    label: string; hint?: string; value:boolean;
    onchange: (v: boolean) => void; disabled?: boolean;
}> = 