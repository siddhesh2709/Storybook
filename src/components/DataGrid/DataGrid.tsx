import { useRef, useState, useMemo, useCallback, memo, type KeyboardEvent } from 'react';
import type { DataGridProps, GridColumn, SortConfig } from './DataGrid.types';
import { useVirtualizer } from './hooks/useVirtualizer';
import { useHistory } from './hooks/useHistory';

function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ');
}

type InternalState<T> = {
    columns: GridColumn<T>[];
    sortConfig: SortConfig[];
    data: T[];
};

export function DataGrid<T extends { id: string }>({
    data: initialData,
    columns: initialColumns,
    height = 500,
    className,
    onSortChange,
    onEdit,
}: DataGridProps<T>) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [focusedCell, setFocusedCell] = useState<{ r: number, c: number } | null>(null);
    const [editingCell, setEditingCell] = useState<{ rowId: string, columnId: string, value: any, error?: string, loading?: boolean } | null>(null);
    const [showColumnMenu, setShowColumnMenu] = useState(false);
    const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

    const { state, set: setState, undo, canUndo } = useHistory<InternalState<T>>({
        columns: initialColumns,
        sortConfig: [],
        data: initialData
    });

    const { columns, sortConfig, data } = state;

    const visibleColumns = useMemo(() => columns.filter(c => (c as any).hidden !== true), [columns]);

    const sortedData = useMemo(() => {
        if (sortConfig.length === 0) return data;

        return [...data].sort((a: T, b: T) => {
            for (const sort of sortConfig) {
                const col = visibleColumns.find(c => c.id === sort.columnId);
                if (!col) continue;

                const field = col.field as keyof T;
                const aValue = a[field];
                const bValue = b[field];

                if (aValue === bValue) continue;
                if (aValue == null) return 1;
                if (bValue == null) return -1;

                const compare = aValue < bValue ? -1 : 1;
                return sort.direction === 'asc' ? compare : -compare;
            }
            return 0;
        });
    }, [data, sortConfig, visibleColumns]);

    const getScrollElement = useCallback(() => containerRef.current, []);
    const estimateRowSize = useCallback(() => 40, []);

    const rowVirtualizer = useVirtualizer({
        count: sortedData.length,
        getScrollElement,
        estimateSize: estimateRowSize,
        overscan: 10,
    });

    const { leftPinned, rightPinned, unpinned } = useMemo(() => {
        const left: GridColumn<T>[] = [];
        const right: GridColumn<T>[] = [];
        const middle: GridColumn<T>[] = [];

        visibleColumns.forEach(col => {
            if (col.pinned === 'left') left.push(col);
            else if (col.pinned === 'right') right.push(col);
            else middle.push(col);
        });

        return { leftPinned: left, rightPinned: right, unpinned: middle };
    }, [visibleColumns]);

    // Create a stable key for column widths to trigger virtualizer recalculation
    const columnWidthKey = useMemo(() => 
        unpinned.map(c => c.width).join('-'), 
    [unpinned]);

    const estimateColSize = useCallback((index: number) => unpinned[index]?.width ?? 100, [unpinned]);
    const colVirtualizer = useVirtualizer({
        count: unpinned.length,
        getScrollElement,
        estimateSize: estimateColSize,
        overscan: 3,
        horizontal: true,
        key: columnWidthKey,
    });

    const handleColumnResize = useCallback((columnId: string, newWidth: number) => {
        setState(prev => ({
            ...prev,
            columns: prev.columns.map(col =>
                col.id === columnId ? { ...col, width: Math.max(col.minWidth || 50, newWidth) } : col
            )
        }));
    }, [setState]);

    const handleSort = useCallback((columnId: string) => {
        setState(prev => {
            const nextSort = [...prev.sortConfig];
            const existingIdx = nextSort.findIndex(s => s.columnId === columnId);

            let direction: 'asc' | 'desc' | null = 'asc';
            if (existingIdx !== -1) {
                const current = nextSort[existingIdx];
                if (current?.direction === 'asc') direction = 'desc';
                else if (current?.direction === 'desc') direction = null;
                nextSort.splice(existingIdx, 1);
            }

            if (direction) {
                nextSort.push({ columnId, direction });
            }

            onSortChange?.(nextSort);
            return { ...prev, sortConfig: nextSort };
        });
    }, [setState, onSortChange]);

    const handleColumnReorder = useCallback((sourceId: string, targetId: string) => {
        if (sourceId === targetId) return;
        setState(prev => {
            const sourceIdx = prev.columns.findIndex(c => c.id === sourceId);
            const targetIdx = prev.columns.findIndex(c => c.id === targetId);

            const newCols = [...prev.columns];
            const [moved] = newCols.splice(sourceIdx, 1);
            if (moved) newCols.splice(targetIdx, 0, moved);

            return { ...prev, columns: newCols };
        });
    }, [setState]);

    const toggleColumnVisibility = useCallback((columnId: string) => {
        setState(prev => ({
            ...prev,
            columns: prev.columns.map(c => c.id === columnId ? { ...c, hidden: !(c as any).hidden } : c)
        }));
    }, [setState]);

    const handleEditCommit = useCallback(async () => {
        if (!editingCell) return;

        setEditingCell(prev => prev ? { ...prev, loading: true, error: undefined } : null);

        try {
            const success = onEdit
                ? await onEdit(editingCell.rowId, editingCell.columnId, editingCell.value)
                : true;

            if (success) {
                setState(prev => {
                    const column = prev.columns.find(c => c.id === editingCell.columnId);
                    const colField = column?.field as keyof T;
                    return {
                        ...prev,
                        data: prev.data.map(r => r.id === editingCell.rowId
                            ? { ...r, [colField]: editingCell.value }
                            : r)
                    };
                });
                setEditingCell(null);
            } else {
                setEditingCell(prev => prev ? { ...prev, loading: false, error: 'Validation failed' } : null);
            }
        } catch (err) {
            setEditingCell(prev => prev ? { ...prev, loading: false, error: 'Save failed' } : null);
        }
    }, [editingCell, onEdit, setState]);

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undo();
            return;
        }

        if (editingCell) {
            if (e.key === 'Enter') handleEditCommit();
            if (e.key === 'Escape') setEditingCell(null);
            return;
        }

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            const { r = 0, c = 0 } = focusedCell || {};
            let nr = r, nc = c;

            if (e.key === 'ArrowUp') nr = Math.max(0, r - 1);
            if (e.key === 'ArrowDown') nr = Math.min(sortedData.length - 1, r + 1);
            if (e.key === 'ArrowLeft') nc = Math.max(0, c - 1);
            if (e.key === 'ArrowRight') nc = Math.min(visibleColumns.length - 1, c + 1);

            setFocusedCell({ r: nr, c: nc });
            rowVirtualizer.scrollToIndex(nr);
        }

        if (e.key === 'Enter' && focusedCell) {
            const col = visibleColumns[focusedCell.c];
            const row = sortedData[focusedCell.r];
            if (col?.editable && row) {
                setEditingCell({ rowId: row.id, columnId: col.id, value: (row as any)[col.field] });
            }
        }
    }, [editingCell, focusedCell, sortedData, visibleColumns, rowVirtualizer, handleEditCommit]);

    const leftPinnedWidth = leftPinned.reduce((acc, c) => acc + c.width, 0);
    const rightPinnedWidth = rightPinned.reduce((acc, c) => acc + c.width, 0);
    const totalContentWidth = leftPinnedWidth + rightPinnedWidth + colVirtualizer.totalSize;

    return (
        <div
            className={cn("relative border border-gray-200 rounded-lg overflow-hidden bg-white shadow-xl flex flex-col font-sans", className)}
            style={{ height }}
            role="grid"
            aria-rowcount={data.length}
            aria-colcount={visibleColumns.length}
            onKeyDown={handleKeyDown}
        >
            <div className="h-12 border-b border-gray-200 bg-gray-50 flex items-center px-4 justify-between z-50">
                <div className="flex items-center gap-2">
                    <button
                        onClick={undo}
                        disabled={!canUndo}
                        className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-40 font-semibold text-gray-700 shadow-sm"
                    >
                        Undo (Ctrl+Z)
                    </button>
                    <div className="relative">
                        <button
                            onClick={() => setShowColumnMenu(!showColumnMenu)}
                            className="px-3 py-1.5 text-xs bg-white border border-gray-300 rounded-md hover:bg-gray-100 font-semibold text-gray-700 shadow-sm"
                        >
                            Columns
                        </button>
                        {showColumnMenu && (
                            <div className="absolute top-full mt-2 left-0 bg-white border border-gray-200 shadow-xl rounded-lg z-[100] p-3 min-w-[220px]">
                                <div className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest border-b pb-1">Column Visibility</div>
                                <div className="max-h-60 overflow-y-auto pr-1">
                                    {columns.map(c => (
                                        <label key={c.id} className="flex items-center gap-3 px-2 py-2 hover:bg-gray-50 cursor-pointer rounded-md text-sm transition-colors">
                                            <input
                                                type="checkbox"
                                                checked={!(c as any).hidden}
                                                onChange={() => toggleColumnVisibility(c.id)}
                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="truncate text-gray-700">{c.title}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                <div className="text-[11px] text-gray-400 font-medium">
                    <span className="text-gray-600 font-bold">{data.length.toLocaleString()}</span> rows × <span className="text-gray-600 font-bold">{visibleColumns.length}</span> columns
                </div>
            </div>

            <div className="flex bg-gray-50 border-b border-gray-300 z-40 relative h-10 overflow-hidden select-none">
                <div className="flex sticky left-0 z-50 bg-gray-50 border-r-2 border-gray-300">
                    {leftPinned.map(col => (
                        <HeaderCell key={col.id} column={col} sortConfig={sortConfig} onSort={handleSort} onResize={handleColumnResize} onDragStart={setDraggedColumn} onDrop={handleColumnReorder} isDragging={draggedColumn === col.id} />
                    ))}
                </div>

                <div className="relative flex-1 h-full overflow-hidden">
                    <div style={{ width: colVirtualizer.totalSize, height: '100%', position: 'relative' }}>
                        {colVirtualizer.virtualItems.map(v => {
                            const col = unpinned[v.index];
                            if (!col) return null;
                            return (
                                <div key={col.id} style={{ position: 'absolute', left: v.start, width: v.size, height: '100%' }}>
                                    <HeaderCell column={col} sortConfig={sortConfig} onSort={handleSort} onResize={handleColumnResize} onDragStart={setDraggedColumn} onDrop={handleColumnReorder} isDragging={draggedColumn === col.id} />
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex sticky right-0 z-50 bg-gray-50 border-l-2 border-gray-300">
                    {rightPinned.map(col => (
                        <HeaderCell key={col.id} column={col} sortConfig={sortConfig} onSort={handleSort} onResize={handleColumnResize} onDragStart={setDraggedColumn} onDrop={handleColumnReorder} isDragging={draggedColumn === col.id} />
                    ))}
                </div>
            </div>

            <div
                ref={containerRef}
                className="flex-1 overflow-auto bg-white"
                style={{ contain: 'strict', willChange: 'scroll-position' }}
                tabIndex={0}
            >
                <div
                    style={{
                        height: rowVirtualizer.totalSize,
                        width: totalContentWidth,
                        position: 'relative',
                        minWidth: '100%'
                    }}
                >
                    {rowVirtualizer.virtualItems.map(vRow => {
                        const row = sortedData[vRow.index];
                        if (!row) return null;
                        return (
                            <VirtualRow
                                key={row.id}
                                vRow={vRow}
                                row={row}
                                leftPinned={leftPinned}
                                unpinned={unpinned}
                                rightPinned={rightPinned}
                                colVirtualizer={colVirtualizer}
                                focusedCell={focusedCell}
                                editingCell={editingCell}
                                setFocusedCell={setFocusedCell}
                                setEditingCell={setEditingCell}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

const HeaderCell = memo(function HeaderCell({ column, sortConfig, onSort, onResize, onDragStart, onDrop, isDragging }: any) {
    const sort = sortConfig.find((s: any) => s.columnId === column.id);
    const [isOver, setIsOver] = useState(false);

    return (
        <div
            className={cn(
                "flex items-center px-4 font-bold text-[10px] text-gray-500 select-none border-r border-gray-200 last:border-r-0 hover:bg-gray-200/50 relative bg-gray-50 uppercase tracking-widest cursor-move h-full group",
                isDragging && "opacity-20",
                isOver && "bg-blue-50 border-l-2 border-l-blue-400"
            )}
            style={{ width: column.width, minWidth: column.width }}
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData('columnId', column.id);
                onDragStart(column.id);
            }}
            onDragOver={(e) => {
                e.preventDefault();
                setIsOver(true);
            }}
            onDragLeave={() => setIsOver(false)}
            onDrop={(e) => {
                e.preventDefault();
                setIsOver(false);
                const sourceId = e.dataTransfer.getData('columnId');
                onDrop(sourceId, column.id);
            }}
        >
            <div className="flex-1 flex items-center justify-between overflow-hidden gap-2 h-full py-2" onClick={() => column.sortable && onSort(column.id)}>
                <span className="truncate">{column.title}</span>
                {column.sortable && (
                    <span className="text-blue-500 w-3 flex-shrink-0 text-[12px]" style={{ transform: sort?.direction === 'desc' ? 'rotate(180deg)' : 'none', opacity: sort ? 1 : 0.2 }}>
                        {sort ? '↑' : '↕'}
                    </span>
                )}
            </div>
            {column.resizable !== false && (
                <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 z-50"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        const startX = e.clientX;
                        const startWidth = column.width;
                        const onMove = (m: MouseEvent) => onResize(column.id, startWidth + (m.clientX - startX));
                        const onUp = () => {
                            document.removeEventListener('mousemove', onMove);
                            document.removeEventListener('mouseup', onUp);
                        };
                        document.addEventListener('mousemove', onMove);
                        document.addEventListener('mouseup', onUp);
                    }}
                />
            )}
        </div>
    );
});

const DataCell = memo(function DataCell({ row, column, isFocused, isEditing, editingState, onFocus, onEdit, onDoubleClick }: any) {
    const value = (row as any)[column.field];

    return (
        <div
            role="gridcell"
            aria-selected={isFocused}
            tabIndex={isFocused ? 0 : -1}
            onClick={onFocus}
            onDoubleClick={onDoubleClick}
            className={cn(
                "flex items-center px-4 text-sm text-gray-700 border-r border-gray-100 last:border-r-0 truncate outline-none relative h-full font-medium",
                isFocused && "ring-2 ring-blue-500 ring-inset z-30 bg-blue-50/40",
            )}
            style={{ width: column.width, minWidth: column.width }}
        >
            {isEditing ? (
                <div className="absolute inset-x-1 inset-y-1 z-50 bg-white">
                    <input
                        autoFocus
                        className={cn(
                            "w-full h-full border-2 border-blue-500 rounded px-2 outline-none text-sm shadow-sm",
                            editingState.error && "border-red-500 ring-1 ring-red-100"
                        )}
                        value={editingState.value}
                        onChange={(e) => onEdit(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        disabled={editingState.loading}
                    />
                    {editingState.error && (
                        <div className="absolute top-full left-0 right-0 bg-red-50 text-red-600 text-[10px] px-2 py-1 rounded-b-md border border-red-200 z-[60] shadow-lg font-bold">
                            {editingState.error}
                        </div>
                    )}
                    {editingState.loading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent animate-spin rounded-full" />
                        </div>
                    )}
                </div>
            ) : (
                <span className="truncate w-full text-gray-800">
                    {column.renderCell ? column.renderCell(row) : value}
                </span>
            )}
        </div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.row === nextProps.row &&
        prevProps.column === nextProps.column &&
        prevProps.isFocused === nextProps.isFocused &&
        prevProps.isEditing === nextProps.isEditing &&
        prevProps.editingState === nextProps.editingState
    );
});

const VirtualRow = memo(function VirtualRow({
    vRow,
    row,
    leftPinned,
    unpinned,
    rightPinned,
    colVirtualizer,
    focusedCell,
    editingCell,
    setFocusedCell,
    setEditingCell
}: any) {
    return (
        <div
            className={cn(
                "absolute left-0 right-0 flex border-b border-gray-100",
                vRow.index % 2 === 0 ? "bg-white" : "bg-gray-50/30",
                "hover:bg-blue-50/50"
            )}
            style={{ height: vRow.size, transform: `translateY(${vRow.start}px)`, willChange: 'transform' }}
            role="row"
            aria-rowindex={vRow.index + 2}
        >
            <div className="flex sticky left-0 z-20 bg-inherit border-r-2 border-gray-200">
                {leftPinned.map((col: any, cIdx: number) => (
                    <DataCell
                        key={col.id}
                        row={row}
                        column={col}
                        isFocused={focusedCell?.r === vRow.index && focusedCell?.c === cIdx}
                        isEditing={editingCell?.rowId === row.id && editingCell?.columnId === col.id}
                        editingState={editingCell}
                        onFocus={() => setFocusedCell({ r: vRow.index, c: cIdx })}
                        onEdit={(v: any) => setEditingCell((prev: any) => prev ? { ...prev, value: v } : null)}
                        onDoubleClick={() => col.editable && setEditingCell({ rowId: row.id, columnId: col.id, value: (row as any)[col.field] })}
                    />
                ))}
            </div>

            <div className="relative flex-1 overflow-hidden">
                {colVirtualizer.virtualItems.map((vCol: any) => {
                    const col = unpinned[vCol.index];
                    if (!col) return null;
                    const logicalColIdx = leftPinned.length + vCol.index;
                    return (
                        <div key={col.id} style={{ position: 'absolute', left: vCol.start, width: vCol.size, height: '100%' }}>
                            <DataCell
                                row={row}
                                column={col}
                                isFocused={focusedCell?.r === vRow.index && focusedCell?.c === logicalColIdx}
                                isEditing={editingCell?.rowId === row.id && editingCell?.columnId === col.id}
                                editingState={editingCell}
                                onFocus={() => setFocusedCell({ r: vRow.index, c: logicalColIdx })}
                                onEdit={(v: any) => setEditingCell((prev: any) => prev ? { ...prev, value: v } : null)}
                                onDoubleClick={() => col.editable && setEditingCell({ rowId: row.id, columnId: col.id, value: (row as any)[col.field] })}
                            />
                        </div>
                    );
                })}
            </div>

            <div className="flex sticky right-0 z-20 bg-inherit border-l-2 border-gray-200">
                {rightPinned.map((col: any, cIdx: number) => {
                    const logicalColIdx = leftPinned.length + unpinned.length + cIdx;
                    return (
                        <DataCell
                            key={col.id}
                            row={row}
                            column={col}
                            isFocused={focusedCell?.r === vRow.index && focusedCell?.c === logicalColIdx}
                            isEditing={editingCell?.rowId === row.id && editingCell?.columnId === col.id}
                            editingState={editingCell}
                            onFocus={() => setFocusedCell({ r: vRow.index, c: logicalColIdx })}
                            onEdit={(v: any) => setEditingCell((prev: any) => prev ? { ...prev, value: v } : null)}
                            onDoubleClick={() => col.editable && setEditingCell({ rowId: row.id, columnId: col.id, value: (row as any)[col.field] })}
                        />
                    )
                })}
            </div>
        </div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.row === nextProps.row &&
        prevProps.vRow.index === nextProps.vRow.index &&
        prevProps.vRow.start === nextProps.vRow.start &&
        prevProps.focusedCell?.r === nextProps.focusedCell?.r &&
        prevProps.focusedCell?.c === nextProps.focusedCell?.c &&
        prevProps.editingCell?.rowId === nextProps.editingCell?.rowId &&
        prevProps.editingCell?.columnId === nextProps.editingCell?.columnId
    );
});
