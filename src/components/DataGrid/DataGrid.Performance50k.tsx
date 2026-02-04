import { DataGrid } from './DataGrid';
import type { GridColumn } from './DataGrid.types';

/**
 * Performance Test: 50,000 Row DataGrid
 * 
 * This file demonstrates the DataGrid handling 50,000+ rows with smooth 60 FPS scrolling.
 * Run this file directly rather than through Storybook to avoid WebSocket payload limits.
 * 
 * To test:
 * 1. Update main.tsx to render this component temporarily
 * 2. Run `npm run dev`
 * 3. Open browser DevTools Performance tab
 * 4. Record while scrolling through the grid
 * 5. Verify 60 FPS maintained
 */

type TestData = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    age: number;
    role: string;
    status: string;
    department: string;
    salary: number;
    hireDate: string;
};

const generateLargeDataset = (count: number): TestData[] => {
    const roles = ['Engineer', 'Manager', 'Director', 'VP', 'Analyst'] as const;
    const departments = ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'] as const;
    
    return Array.from({ length: count }, (_, i) => ({
        id: `row-${i}`,
        firstName: `First${i}`,
        lastName: `Last${i}`,
        email: `user${i}@company.com`,
        age: 22 + (i % 45),
        role: roles[i % roles.length] as string,
        status: i % 3 === 0 ? 'Active' : i % 3 === 1 ? 'On Leave' : 'Remote',
        department: departments[i % departments.length] as string,
        salary: 50000 + (i % 100) * 1000,
        hireDate: `2020-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    }));
};

const columns: GridColumn<TestData>[] = [
    { id: 'id', title: 'ID', field: 'id', width: 80, sortable: true, pinned: 'left' },
    { id: 'firstName', title: 'First Name', field: 'firstName', width: 120, sortable: true, editable: true },
    { id: 'lastName', title: 'Last Name', field: 'lastName', width: 120, sortable: true, editable: true },
    { id: 'email', title: 'Email', field: 'email', width: 200, editable: true },
    { id: 'age', title: 'Age', field: 'age', width: 70, sortable: true },
    { id: 'role', title: 'Role', field: 'role', width: 100, sortable: true },
    { id: 'department', title: 'Department', field: 'department', width: 120, sortable: true },
    { id: 'status', title: 'Status', field: 'status', width: 100, pinned: 'right' },
    { id: 'salary', title: 'Salary', field: 'salary', width: 100, sortable: true },
    { id: 'hireDate', title: 'Hire Date', field: 'hireDate', width: 120, sortable: true },
];

export function Performance50kTest() {
    const data = generateLargeDataset(50000);
    
    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">50,000 Row Performance Test</h1>
            <p className="mb-4 text-gray-600">
                Testing DataGrid with 50,000 rows. Open DevTools Performance tab to verify 60 FPS during scrolling.
            </p>
            <DataGrid
                data={data}
                columns={columns}
                height={700}
                onEdit={async (rowId, columnId, value) => {
                    console.log('Edit:', { rowId, columnId, value });
                    await new Promise(r => setTimeout(r, 500));
                    return true;
                }}
            />
        </div>
    );
}
