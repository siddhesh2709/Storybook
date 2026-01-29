import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { DataGrid } from './DataGrid';
import type { GridColumn } from './DataGrid.types';

type TestData = { id: string; name: string; age: number };

const sampleColumns: GridColumn<TestData>[] = [
    { id: 'id', title: 'ID', field: 'id', width: 50, pinned: 'left' },
    { id: 'name', title: 'Name', field: 'name', width: 100, sortable: true, editable: true },
    { id: 'age', title: 'Age', field: 'age', width: 50, sortable: true },
];

const sampleData: TestData[] = Array.from({ length: 100 }, (_, i) => ({
    id: `row-${i}`,
    name: `User ${i}`,
    age: 20 + (i % 50),
}));

describe('DataGrid', () => {
    it('renders without crashing', () => {
        render(<DataGrid data={sampleData} columns={sampleColumns} />);
        expect(screen.getByRole('grid')).toBeInTheDocument();
    });

    it('virtualizes rows', () => {
        render(<DataGrid data={sampleData} columns={sampleColumns} height={400} />);
        const rows = screen.getAllByRole('row');
        expect(rows.length).toBeGreaterThan(5);
        expect(rows.length).toBeLessThan(sampleData.length);
    });

    it('handles multi-sort', async () => {
        const user = userEvent.setup();
        render(<DataGrid data={sampleData} columns={sampleColumns} />);

        const nameHeader = screen.getByText('Name');
        await user.click(nameHeader);
        expect(screen.getByText('↑')).toBeInTheDocument();

        const ageHeader = screen.getByText('Age');
        await user.click(ageHeader);

        // Multi-sort allows both to have indicators
        expect(screen.getAllByText('↑').length).toBeGreaterThanOrEqual(1);
    });

    it('handles column visibility toggling', async () => {
        const user = userEvent.setup();
        render(<DataGrid data={sampleData} columns={sampleColumns} />);

        const columnButton = screen.getByText('Columns');
        await user.click(columnButton);

        const ageCheckbox = screen.getByLabelText('Age');
        expect(ageCheckbox).toBeChecked();

        await user.click(ageCheckbox);
        expect(screen.queryByText('Age', { selector: 'span.truncate' })).not.toBeInTheDocument();
    });

    it('handles editing and optimistic updates', async () => {
        const user = userEvent.setup();
        const onEdit = vi.fn().mockResolvedValue(true);
        render(<DataGrid data={sampleData} columns={sampleColumns} onEdit={onEdit} />);

        const cell = screen.getByText('User 0').closest('[role="gridcell"]');
        if (!cell) throw new Error('Cell not found');

        await user.dblClick(cell);
        const input = screen.getByRole('textbox');
        await user.clear(input);
        await user.type(input, 'New Name');
        await user.keyboard('{Enter}');

        await waitFor(() => expect(onEdit).toHaveBeenCalledWith('row-0', 'name', 'New Name'));
        expect(screen.getByText('New Name')).toBeInTheDocument();
    });
});
