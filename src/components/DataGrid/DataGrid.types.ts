import type { ReactNode } from 'react';

export type GridColumn<T = any> = {
    id: string;
    title: string;
    field: keyof T | string;
    width: number;
    minWidth?: number;
    maxWidth?: number;
    sortable?: boolean;
    resizable?: boolean;
    editable?: boolean;
    pinned?: 'left' | 'right';
    hidden?: boolean;
    renderCell?: (row: T) => ReactNode;
    renderHeader?: (column: GridColumn<T>) => ReactNode;
    validator?: (value: any) => boolean | string | Promise<boolean | string>;
};

export type SortDirection = 'asc' | 'desc' | null;

export type SortConfig = {
    columnId: string;
    direction: SortDirection;
};

export type DataGridProps<T> = {
    data: T[];
    columns: GridColumn<T>[];
    height?: number;
    className?: string;
    onSortChange?: (sortConfig: SortConfig[]) => void;
    onEdit?: (rowId: string, columnId: string, newValue: any) => Promise<boolean>;
};

export type Row<T> = {
    id: string;
    data: T;
    selected?: boolean;
};
