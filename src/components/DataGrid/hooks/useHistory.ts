import { useState, useCallback, useRef } from 'react';

export function useHistory<T>(initialState: T) {
    const [state, setState] = useState<T>(initialState);
    const historyRef = useRef<T[]>([]);
    const pointerRef = useRef(-1);
    const [canUndo, setCanUndo] = useState(false);

    const set = useCallback((nextState: T | ((prev: T) => T)) => {
        setState((current) => {
            const newState = typeof nextState === 'function' ? (nextState as Function)(current) : nextState;

            // Add current to history before updating to newState
            const newHistory = historyRef.current.slice(0, pointerRef.current + 1);
            newHistory.push(current);

            // Limit history size to 50
            if (newHistory.length > 50) {
                newHistory.shift();
            } else {
                pointerRef.current += 1;
            }

            historyRef.current = newHistory;
            setCanUndo(true);
            return newState;
        });
    }, []);

    const undo = useCallback(() => {
        if (pointerRef.current < 0) return;

        const prevState = historyRef.current[pointerRef.current];
        if (prevState === undefined) return;

        setState(prevState);
        pointerRef.current -= 1;
        setCanUndo(pointerRef.current >= 0);
    }, []);

    // Simple Redo can be added similarly by keeping track of redo stack.
    // For this assignment "Undo support" is explicitly mentioned.

    return { state, set, undo, canUndo };
}
