import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { DataGrid } from './DataGrid';
import type { GridColumn } from './DataGrid.types';

type MockData = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    age: number;
    role: string;
    status: string;
    bio: string;
};

const DataGridMocked = (props: React.ComponentProps<typeof DataGrid<MockData>>) => <DataGrid<MockData> {...props} />;

const meta = {
    title: 'Components/DataGrid',
    component: DataGridMocked,
    parameters: {
        layout: 'padded',
    },
    tags: ['autodocs'],
} satisfies Meta<typeof DataGridMocked>;

export default meta;
type Story = StoryObj<typeof meta>;

const generateData = (count: number): MockData[] => {
    return Array.from({ length: count }, (_, i) => ({
        id: `row-${i}`,
        firstName: `First ${i}`,
        lastName: `Last ${i}`,
        email: `user${i}@example.com`,
        age: 20 + (i % 50),
        role: i % 3 === 0 ? 'Admin' : i % 3 === 1 ? 'Editor' : 'Viewer',
        status: i % 2 === 0 ? 'Active' : 'Inactive',
        bio: `This is a long bio for user index ${i} to test virtualization and scrolling behavior properly. `.repeat(10),
    }));
};

const columns: GridColumn<MockData>[] = [
    { id: 'id', title: 'ID', field: 'id', width: 80, sortable: true, pinned: 'left' },
    { id: 'firstName', title: 'First Name', field: 'firstName', width: 150, sortable: true, editable: true },
    { id: 'lastName', title: 'Last Name', field: 'lastName', width: 150, sortable: true, editable: true },
    { id: 'age', title: 'Age', field: 'age', width: 80, sortable: true, editable: true },
    { id: 'email', title: 'Email', field: 'email', width: 250, editable: true },
    { id: 'role', title: 'Role', field: 'role', width: 120, editable: true },
    { id: 'status', title: 'Status', field: 'status', width: 120, pinned: 'right' },
    { id: 'bio', title: 'Bio', field: 'bio', width: 500 },
];

export const Default: Story = {
    args: {
        data: generateData(100),
        columns,
        height: 500,
        onEdit: async () => {
            await new Promise(r => setTimeout(r, 1000));
            return true;
        }
    },
};

export const MassiveDataset: Story = {
    args: {
        data: generateData(50000),
        columns,
        height: 600,
    },
};

export const EditWithValidationFailure: Story = {
    args: {
        data: generateData(20),
        columns,
        height: 400,
        onEdit: async (_rid, _cid, value) => {
            await new Promise(r => setTimeout(r, 1000));
            if (value.length < 3) return false;
            return true;
        }
    },
};

export const HighContrast: Story = {
    args: {
        data: generateData(100),
        columns,
        height: 500,
        className: 'contrast-more:filter-none',
    },
    parameters: {
        backgrounds: { default: 'dark' }
    }
};

export const MultiSort: Story = {
    args: {
        data: generateData(100).map(d => ({ ...d, firstName: d.id.includes('1') ? 'A' : 'B' })),
        columns,
        height: 500,
    }
};
