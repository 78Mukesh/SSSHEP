
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction, Bill, BillMap, ToastMessage } from './types';
import Header from './components/Header';
import StatCard from './components/StatCard';
import BalanceCard from './components/BalanceCard';
import TransactionForm from './components/TransactionForm';
import ActionButtons from './components/ActionButtons';
import TransactionTable from './components/TransactionTable';
import ViewTransactionModal from './components/ViewTransactionModal';
import BillUploadModal from './components/BillUploadModal';
import AiAnalysisModal from './components/AiAnalysisModal';
import Toast from './components/Toast';
import ScrollToTopButton from './components/ScrollToTopButton';
import TransactionFilters from './components/TransactionFilters';
import { analyzeExpensesWithAI } from './services/geminiService';
import PrintPreviewModal from './components/PrintPreviewModal';
import ConfirmationModal from './components/ConfirmationModal';
import { formatInr, isTravelPurpose, sortTransactionsForReporting } from './utils/helpers';

// Default constants
const INITIAL_BUDGET = 30000;
const DEFAULT_PURPOSES = [
    'Electricity charges', 'Milk charges', 'Maid charges', 'Petrol', 'Vegetables', 'Medicine charges', 'Metro charges', 'Bus charges', 'Travelling charges', 'Bus pass', 'Stationary', 'Water can', 'Porter charges', 'Rapido charges', 'Auto charges', 'Extra amount for auto', 'Uber charges', 'Maid charges (SSSSDP)', 'Electricity charges (SSSSDP)', 'Internet charges (SSSSDP)', 'Flowers & Garland', 'Fruits', 'Bike repair', 'Mixer repair', 'Motor repair', 'Xerox', 'Colour Xerox', 'Bank document xerox', 'Trust document xerox', 'Chappal', 'Shoes', 'Sandal', 'Socks', 'Kerchief', 'Underwear', 'Baniyan', 'Shirt', 'T-shirt', 'Pants', 'White dress', 'Track pants', 'Opticals', 'Exam fee', 'Record books'
];
const DEFAULT_SHOPS = [
    'Mvsr college', 'Sri Indu College', 'Anurag college', 'Resonance', 'D Mart', 'Decathlon', 'Vandana shopping mall', 'Trends', 'Amazon shopping', 'Flipkart', 'Apollo pharmacy', 'Pharma hub', 'MedPlus', 'Vijayalakshmi diagnostics', 'Soujanya stationery', 'Venkateswara stationery', 'Lahari xerox', 'Tirumala xerox', 'Pramila xerox', 'A1 computers'
];

interface SummaryData {
    stats: [string, string][];
    topPurposes: [string, string][];
    topCustomers: [string, string][];
}

interface ConfirmationState {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
}

const App: React.FC = () => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [bills, setBills] = useState<BillMap>({});
    const [budget, setBudget] = useState(INITIAL_BUDGET);
    const [validPurposes, setValidPurposes] = useState<string[]>(DEFAULT_PURPOSES);
    const [validShops, setValidShops] = useState<string[]>(DEFAULT_SHOPS);
    
    // Filtering state
    const [filter, setFilter] = useState<'all' | 'withBill' | 'withoutBill'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [customerFilter, setCustomerFilter] = useState('');
    const [purposeFilter, setPurposeFilter] = useState('');
    
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [uploadingBillFor, setUploadingBillFor] = useState<Transaction | null>(null);
    const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
    
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<any | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    
    // State for editable budget
    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [newBudgetValue, setNewBudgetValue] = useState('');


    // State for print preview modal
    const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
    const [pdfObjectUrl, setPdfObjectUrl] = useState<string | null>(null);
    const [printPreviewTitle, setPrintPreviewTitle] = useState('');
    
    // State for confirmation modal
    const [confirmationState, setConfirmationState] = useState<ConfirmationState>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => {},
    });
    
    const isAiEnabled = !!process.env.API_KEY;

    const addToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
    }, []);

    // Load data from localStorage on initial render
    useEffect(() => {
        try {
            const savedTransactions = localStorage.getItem('transactions');
            if (savedTransactions) setTransactions(JSON.parse(savedTransactions));

            const savedBills = localStorage.getItem('bills');
            if (savedBills) setBills(JSON.parse(savedBills));

            const savedBudget = localStorage.getItem('budget');
            if (savedBudget) {
              const parsedBudget = parseFloat(savedBudget);
              setBudget(parsedBudget);
              setNewBudgetValue(parsedBudget.toString());
            } else {
              setNewBudgetValue(INITIAL_BUDGET.toString());
            }

            const savedPurposes = localStorage.getItem('validPurposes');
            if (savedPurposes) setValidPurposes(JSON.parse(savedPurposes));
            
            const savedShops = localStorage.getItem('validShops');
            if (savedShops) setValidShops(JSON.parse(savedShops));
        } catch (error) {
            addToast('Failed to load data from storage.', 'error');
            console.error(error);
        }
    }, [addToast]);

    // Save data to localStorage whenever it changes
    useEffect(() => {
        try {
            localStorage.setItem('transactions', JSON.stringify(transactions));
            localStorage.setItem('bills', JSON.stringify(bills));
            localStorage.setItem('budget', budget.toString());
            localStorage.setItem('validPurposes', JSON.stringify(validPurposes));
            localStorage.setItem('validShops', JSON.stringify(validShops));
        } catch (error) {
            addToast('Failed to save data.', 'error');
            console.error(error);
        }
    }, [transactions, bills, budget, validPurposes, validShops, addToast]);
    
    const dismissToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const { withBillAmount, withoutBillAmount, travelChargesAmount, remainingBalance } = useMemo(() => {
        const amounts = transactions.reduce(
            (acc, t) => {
                if (t.billType === 'withBill') {
                    acc.withBill += t.amountGiven;
                } else {
                    acc.withoutBill += t.amountGiven;
                }
                
                if (isTravelPurpose(t.purpose)) {
                    acc.travel += t.amountGiven;
                }
                return acc;
            },
            { withBill: 0, withoutBill: 0, travel: 0 }
        );
        const totalSpent = amounts.withBill + amounts.withoutBill;
        return {
            withBillAmount: amounts.withBill,
            withoutBillAmount: amounts.withoutBill,
            travelChargesAmount: amounts.travel,
            remainingBalance: budget - totalSpent,
        };
    }, [transactions, budget]);

    const {uniqueCustomers, uniquePurposes} = useMemo(() => {
        const customers = new Set(transactions.map(t => t.customerName));
        const purposes = new Set(transactions.map(t => t.purpose));
        return {
            uniqueCustomers: Array.from(customers).sort(),
            uniquePurposes: Array.from(purposes).sort()
        };
    }, [transactions]);
    
    const sortedTransactions = useMemo(() => {
        const filtered = transactions
            .filter(t => {
                // Bill type filter
                if (filter !== 'all' && t.billType !== filter) {
                    return false;
                }
                // Customer filter
                if (customerFilter && t.customerName !== customerFilter) {
                    return false;
                }
                // Purpose filter
                if (purposeFilter && t.purpose !== purposeFilter) {
                    return false;
                }
                // Search term filter
                if (searchTerm) {
                    const lowerCaseSearch = searchTerm.toLowerCase();
                    return (
                        t.customerName.toLowerCase().includes(lowerCaseSearch) ||
                        (t.shopName && t.shopName.toLowerCase().includes(lowerCaseSearch)) ||
                        t.purpose.toLowerCase().includes(lowerCaseSearch)
                    );
                }
                return true;
            });

        return [...filtered].sort((a, b) => {
            const [dayA, monthA, yearA] = a.date.split('/').map(Number);
            const dateA = new Date(yearA, monthA - 1, dayA);
            const [dayB, monthB, yearB] = b.date.split('/').map(Number);
            const dateB = new Date(yearB, monthB - 1, dayB);
            return dateB.getTime() - dateA.getTime();
        });
    }, [transactions, filter, searchTerm, customerFilter, purposeFilter]);
    
    const sortedForExportTransactions = useMemo(() => {
        return sortTransactionsForReporting(transactions);
    }, [transactions]);


    const handleAddOrUpdateTransaction = useCallback((transactionData: Omit<Transaction, 'id'>, editingId: string | null, billFile: File | null): boolean => {
        if (parseFloat(transactionData.amountGiven.toString()) > remainingBalance && !editingId) {
            addToast('Amount exceeds remaining balance.', 'error');
            return false;
        }

        if (editingId) {
            setTransactions(prev => prev.map(t => t.id === editingId ? { ...transactionData, id: editingId } : t));
            addToast('Transaction updated successfully.', 'success');
        } else {
            const newTransaction: Transaction = { ...transactionData, id: Date.now().toString() };
            setTransactions(prev => [...prev, newTransaction]);
            addToast('Transaction added successfully.', 'success');

            if (billFile && newTransaction.billType === 'withBill') {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const bill: Bill = {
                        name: billFile.name,
                        type: billFile.type,
                        size: billFile.size,
                        data: reader.result as string,
                        uploadedAt: new Date().toISOString(),
                    };
                    setBills(prev => ({ ...prev, [newTransaction.id]: bill }));
                };
                reader.readAsDataURL(billFile);
            }
        }

        if (!validPurposes.includes(transactionData.purpose)) {
            setValidPurposes(prev => [...new Set([...prev, transactionData.purpose])].sort());
        }
        
        if (transactionData.shopName && !validShops.includes(transactionData.shopName)) {
            setValidShops(prev => [...new Set([...prev, transactionData.shopName])].sort());
        }
        
        setIsTransactionModalOpen(false);
        setEditingTransaction(null);
        return true;
    }, [remainingBalance, validPurposes, validShops, addToast]);

    const handleEditTransaction = (transaction: Transaction) => {
        setEditingTransaction(transaction);
        setIsTransactionModalOpen(true);
    };
    
    const handleUpdateBudget = () => {
        const newBudgetNumber = parseFloat(newBudgetValue);
        if (!isNaN(newBudgetNumber) && newBudgetNumber > 0) {
            setBudget(newBudgetNumber);
            setIsEditingBudget(false);
            addToast('Budget updated successfully.', 'success');
        } else {
            addToast('Please enter a valid positive number for the budget.', 'error');
            setNewBudgetValue(budget.toString());
        }
    };

    const handleOpenAddTransactionModal = () => {
        setEditingTransaction(null);
        setIsTransactionModalOpen(true);
    };

    const handleCloseTransactionModal = () => {
        setIsTransactionModalOpen(false);
        setEditingTransaction(null);
    };

    const closeConfirmationModal = () => {
        setConfirmationState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
    };

    const handleDelete = (id: string) => {
        setConfirmationState({
            isOpen: true,
            title: 'Confirm Deletion',
            message: 'Are you sure you want to delete this transaction? This action is permanent.',
            onConfirm: () => {
                setTransactions(prev => prev.filter(t => t.id !== id));
                setBills(prev => {
                    const newBills = { ...prev };
                    delete newBills[id];
                    return newBills;
                });
                addToast('Transaction deleted.', 'info');
                closeConfirmationModal();
            }
        });
    };

    const handleDeleteAllTransactions = () => {
        setConfirmationState({
            isOpen: true,
            title: 'Delete All Transactions',
            message: 'Are you sure you want to delete ALL transactions? This action cannot be undone.',
            onConfirm: () => {
                setTransactions([]);
                setBills({});
                addToast('All transactions have been deleted.', 'success');
                closeConfirmationModal();
            }
        });
    };
    
    const handleClearFilters = () => {
        setFilter('all');
        setSearchTerm('');
        setCustomerFilter('');
        setPurposeFilter('');
        addToast('Filters cleared.', 'info');
    };

    const handleSaveBill = (transactionId: string, bill: Bill) => {
        setBills(prev => ({...prev, [transactionId]: bill }));
        addToast('Bill saved successfully.', 'success');
        setUploadingBillFor(null);
    };

    const handleViewTransaction = (transaction: Transaction) => {
        setViewingTransaction(transaction);
    };
    
    const handleViewBill = (id: string) => {
        const bill = bills[id];
        if (!bill) {
            addToast('Bill not found.', 'error');
            return;
        }
        const byteString = atob(bill.data.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        const blob = new Blob([ab], { type: bill.type });
        const fileURL = URL.createObjectURL(blob);
        window.open(fileURL, '_blank');
    };

    const handlePrintBill = (id: string) => {
        const bill = bills[id];
        if (!bill) {
            addToast('Bill not found.', 'error');
            return;
        }

        if (bill.type.startsWith('image/')) {
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(`
                    <html>
                        <head><title>Print Bill</title></head>
                        <body style="margin: 0; text-align: center;">
                            <img src="${bill.data}" style="max-width: 100%;" onload="window.focus(); window.print(); window.close();" />
                        </body>
                    </html>
                `);
                printWindow.document.close();
            }
        } else if (bill.type === 'application/pdf') {
             const byteString = atob(bill.data.split(',')[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: bill.type });
            const url = URL.createObjectURL(blob);

            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.visibility = 'hidden';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = 'none';
            iframe.src = url;
            document.body.appendChild(iframe);
            iframe.onload = () => {
                try {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                } catch (e) {
                    addToast('Could not print PDF automatically. Please print from the opened tab.', 'info');
                    window.open(url, '_blank');
                }
                setTimeout(() => {
                    document.body.removeChild(iframe);
                    URL.revokeObjectURL(url);
                }, 2000);
            };
        } else {
            addToast('Printing is not supported for this file type.', 'info');
        }
    };

    const handleRemoveBill = (id: string) => {
        setConfirmationState({
            isOpen: true,
            title: 'Remove Bill',
            message: 'Are you sure you want to remove this bill? The transaction will remain.',
            onConfirm: () => {
                setBills(prev => {
                    const newBills = { ...prev };
                    delete newBills[id];
                    return newBills;
                });
                addToast('Bill removed.', 'info');
                closeConfirmationModal();
            }
        });
    };
    
    const handleReset = () => {
        setConfirmationState({
            isOpen: true,
            title: 'Reset Application',
            message: 'DANGER: Are you sure you want to reset the entire application? All data will be lost.',
            onConfirm: () => {
                setTransactions([]);
                setBills({});
                setBudget(INITIAL_BUDGET);
                setValidPurposes(DEFAULT_PURPOSES);
                setValidShops(DEFAULT_SHOPS);

                try {
                    localStorage.clear();
                } catch (e) {
                    console.error("Error clearing localStorage:", e);
                    addToast('Error clearing stored data.', 'error');
                }

                addToast('All app data has been reset.', 'success');
                closeConfirmationModal();
            }
        });
    };
    
    const handleClosePrintPreview = () => {
        setIsPrintPreviewOpen(false);
        if (pdfObjectUrl) {
            URL.revokeObjectURL(pdfObjectUrl);
        }
        setPdfObjectUrl(null);
    };
    
    const generatePdfDoc = useCallback((title: string, head: string[][], body: (string|number)[][], summaryData?: SummaryData) => {
        const { jsPDF } = (window as any).jspdf;
        const doc = new jsPDF();
        
        // Helper to replace Rupee symbol for PDF compatibility
        const sanitizeForPdf = (text: string) => text.replace(/₹/g, 'INR ');

        doc.setFontSize(18);
        doc.text(title, 14, 22);
        
        let currentY = 30;

        if (summaryData) {
            // Main stats table
            (doc as any).autoTable({
                body: summaryData.stats.map(row => row.map(sanitizeForPdf)),
                startY: currentY,
                theme: 'plain',
                styles: { fontSize: 9, cellPadding: 1.5, halign: 'left' },
                columnStyles: { 
                    0: { fontStyle: 'bold', cellWidth: 40 },
                    1: { halign: 'right' }
                },
                didDrawPage: (data: any) => { currentY = data.cursor.y; }
            });
            currentY += 8;
            
            // Top purposes table
            doc.setFontSize(11);
            doc.text('Top 5 Spending by Purpose', 14, currentY);
            currentY += 4;
            (doc as any).autoTable({
                head: [['Purpose', 'Amount']],
                body: summaryData.topPurposes.map(row => row.map(sanitizeForPdf)),
                startY: currentY,
                theme: 'striped',
                headStyles: { fillColor: [78, 115, 223] },
                styles: { fontSize: 9 },
                didDrawPage: (data: any) => { currentY = data.cursor.y; }
            });
            currentY += 8;
            
            // Top customers table
            doc.setFontSize(11);
            doc.text('Top 5 Spending by Customer', 14, currentY);
            currentY += 4;
            (doc as any).autoTable({
                head: [['Customer', 'Amount']],
                body: summaryData.topCustomers.map(row => row.map(sanitizeForPdf)),
                startY: currentY,
                theme: 'striped',
                headStyles: { fillColor: [78, 115, 223] },
                styles: { fontSize: 9 },
                didDrawPage: (data: any) => { currentY = data.cursor.y; }
            });
            currentY = (doc as any).lastAutoTable.finalY + 5;
        }

        // Main transaction table (if body is provided)
        if (body.length > 0) {
            (doc as any).autoTable({
                head: head,
                body: body,
                startY: currentY + 5,
                theme: 'grid',
                styles: { fontSize: 8 },
                headStyles: { fillColor: [78, 115, 223] },
            });
        }

        return doc;
    }, []);

    const handlePrintAll = useCallback(() => {
        if (transactions.length === 0) {
            addToast('No transactions to print.', 'info');
            return;
        }
        const head = [['Date', 'Customer', 'Shop', 'Bill Type', 'Purpose', 'Amount (INR)', 'Bill']];
        const body = sortedForExportTransactions.map(t => [
            t.date,
            t.customerName,
            t.shopName || 'N/A',
            t.billType === 'withBill' ? 'Bill' : 'Without Bill',
            t.purpose,
            t.amountGiven.toFixed(2),
            bills[t.id] ? 'Yes' : 'No'
        ]);

        const doc = generatePdfDoc('All Transactions Report', head, body);
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        setPdfObjectUrl(url);
        setPrintPreviewTitle('All Transactions');
        setIsPrintPreviewOpen(true);
    }, [transactions.length, sortedForExportTransactions, bills, addToast, generatePdfDoc]);

    const handleSummaryReport = useCallback((action: 'print' | 'download') => {
        if (transactions.length === 0) {
            addToast('No data for summary.', 'info');
            return;
        }

        const getTopSpending = (field: 'purpose' | 'customerName'): [string, string][] => {
            const spendingMap = new Map<string, number>();
            transactions.forEach(t => {
                const key = t[field] || 'N/A';
                spendingMap.set(key, (spendingMap.get(key) || 0) + t.amountGiven);
            });
            return Array.from(spendingMap.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, amount]) => [`${name}`, formatInr(amount)]);
        };
        
        const totalSpent = withBillAmount + withoutBillAmount;

        const summaryData: SummaryData = {
            stats: [
                ['Initial Budget:', formatInr(budget)],
                ['Total Transactions:', transactions.length.toString()],
                ['', ''],
                ['Total Spent:', formatInr(totalSpent)],
                ['  - With Bill:', formatInr(withBillAmount)],
                ['  - Without Bill:', formatInr(withoutBillAmount)],
                ['  - Travel Charges:', formatInr(travelChargesAmount)],
                ['', ''],
                ['Remaining Balance:', formatInr(remainingBalance)],
            ],
            topPurposes: getTopSpending('purpose'),
            topCustomers: getTopSpending('customerName'),
        };

        const doc = generatePdfDoc('Expense Summary Report', [], [], summaryData);
        
        if (action === 'print') {
            const blob = doc.output('blob');
            const url = URL.createObjectURL(blob);
            setPdfObjectUrl(url);
            setPrintPreviewTitle('Summary Report');
            setIsPrintPreviewOpen(true);
        } else {
            doc.save(`SSSHEP_Summary_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
            addToast('Summary report downloaded.', 'success');
        }
    }, [transactions, budget, withBillAmount, withoutBillAmount, travelChargesAmount, remainingBalance, addToast, generatePdfDoc]);
    
    const handleDownloadAll = useCallback(() => {
        if (transactions.length === 0) {
            addToast('No transactions to download.', 'info');
            return;
        }
        const head = [['Date', 'Customer', 'Shop', 'Bill Type', 'Purpose', 'Amount (INR)', 'Bill']];
        const body = sortedForExportTransactions.map(t => [
            t.date,
            t.customerName,
            t.shopName || 'N/A',
            t.billType === 'withBill' ? 'Bill' : 'Without Bill',
            t.purpose,
            t.amountGiven,
            bills[t.id] ? 'Yes' : 'No'
        ]);
        const doc = generatePdfDoc('All_Transactions_Report', head, body);
        doc.save(`SSSHEP_All_Transactions_${new Date().toISOString().slice(0, 10)}.pdf`);
        addToast('"All Transactions" report downloaded.', 'success');
    }, [transactions.length, sortedForExportTransactions, bills, addToast, generatePdfDoc]);


    const handleExport = () => {
        if (transactions.length === 0) {
            addToast('No transactions to export.', 'error');
            return;
        }

        const exportData = sortedForExportTransactions.map(t => ({
            'Date': t.date,
            'Customer Name': t.customerName,
            'Shop Name': t.shopName || '',
            'Bill Type': t.billType === 'withBill' ? 'With Bill' : 'Without Bill',
            'Purpose': t.purpose,
            'Amount': t.amountGiven
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);

        ws['!cols'] = [ { wch: 12 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 30 }, { wch: 15 } ];
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
        XLSX.writeFile(wb, `SSSHEP_Transactions_${new Date().toISOString().slice(0, 10)}.xlsx`);
        addToast('Transactions exported successfully.', 'success');
    };
    
    const handleDownloadAllBills = async () => {
        if (Object.keys(bills).length === 0) {
            addToast('No bills available to download.', 'info');
            return;
        }

        const zip = new JSZip();
        for (const transactionId in bills) {
            const bill = bills[transactionId];
            const base64Data = bill.data.split(',')[1];
            const safeFilename = bill.name.replace(/[^a-z0-9_.-]/gi, '_');
            zip.file(`${transactionId}_${safeFilename}`, base64Data, { base64: true });
        }

        try {
            addToast('Zipping bills... Please wait.', 'info');
            const content = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `ExpenseTracker_Bills_${new Date().toISOString().slice(0, 10)}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            addToast('Bills downloaded successfully.', 'success');
        } catch (error) {
            console.error("Error creating zip file:", error);
            addToast('Failed to create zip file.', 'error');
        }
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = new Uint8Array(event.target!.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'dd/mm/yyyy' });

                if (json.length === 0) {
                    throw new Error("The selected file is empty or in an unsupported format.");
                }

                const requiredHeaders = ['Date', 'Customer Name', 'Bill Type', 'Purpose', 'Amount'];
                const fileHeaders = json[0] ? Object.keys(json[0]) : [];
                
                const lowerCaseFileHeaders = fileHeaders.map(h => h.toLowerCase());
                const missingHeaders = requiredHeaders.filter(
                  (rh) => !lowerCaseFileHeaders.includes(rh.toLowerCase())
                );

                if (missingHeaders.length > 0) {
                    throw new Error(`Import file is missing required columns: ${missingHeaders.join(', ')}`);
                }

                const headerMap: { [key: string]: string } = {};
                fileHeaders.forEach(h => { headerMap[h.toLowerCase()] = h; });

                const newTransactions: Transaction[] = json.map((row: any, index) => {
                    const rowNum = index + 2;
                    const date = row[headerMap['date']];
                    const customerName = row[headerMap['customer name']];
                    const billTypeStr = (row[headerMap['bill type']] || '').toLowerCase();
                    const purpose = row[headerMap['purpose']];
                    const amountStr = String(row[headerMap['amount']] || '').replace(/[₹,]/g, '').trim();
                    const amount = parseFloat(amountStr);
                    const shopName = row[headerMap['shop name']] || '';

                    if (!date) throw new Error(`Missing 'Date' in row ${rowNum}.`);
                    if (!customerName) throw new Error(`Missing 'Customer Name' in row ${rowNum}.`);
                    if (!billTypeStr) throw new Error(`Missing 'Bill Type' in row ${rowNum}.`);
                    if (!purpose) throw new Error(`Missing 'Purpose' in row ${rowNum}.`);
                    if (isNaN(amount)) throw new Error(`Invalid or missing 'Amount' in row ${rowNum}. It must be a number.`);

                    const billType: 'withBill' | 'withoutBill' = billTypeStr.includes('without') ? 'withoutBill' : 'withBill';
                    
                    return {
                        id: `${Date.now()}-${index}`,
                        date: date,
                        customerName: customerName.toString(),
                        shopName: shopName.toString(),
                        billType: billType,
                        purpose: purpose.toString(),
                        amountGiven: amount,
                    };
                });
                
                setTransactions(prev => [...prev, ...newTransactions]);
                addToast(`${newTransactions.length} transactions imported successfully.`, 'success');
            } catch (error: any) {
                addToast(`Import failed: ${error.message}`, 'error');
                console.error(error);
            } finally {
                e.target.value = ''; // Reset file input
            }
        };
        reader.readAsArrayBuffer(file);
    };
    
    const handleAnalyze = async () => {
        setIsAiModalOpen(true);
        setIsAiLoading(true);
        setAiError(null);
        setAiAnalysis(null);
        try {
            const result = await analyzeExpensesWithAI(transactions, withBillAmount + withoutBillAmount, budget, travelChargesAmount);
            setAiAnalysis(result);
        } catch (error: any) {
            setAiError(error.message || "An unknown error occurred.");
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 p-4 md:p-6 lg:p-8">
            <div className="container glass-card max-w-7xl mx-auto p-6 md:p-8">
                <Header />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <StatCard 
                        title="Initial Budget" 
                        amount={budget} 
                        icon="fa-wallet" 
                        colorClass="indigo" 
                        isEditable={true}
                        isEditing={isEditingBudget}
                        onEditToggle={() => {
                            setIsEditingBudget(!isEditingBudget);
                            setNewBudgetValue(budget.toString());
                        }}
                        newBudgetValue={newBudgetValue}
                        onBudgetChange={(e) => setNewBudgetValue(e.target.value)}
                        onBudgetSave={handleUpdateBudget}
                    />
                    <StatCard title="Bill" amount={withBillAmount} icon="fa-receipt" colorClass="green">
                        <button onClick={() => setFilter(filter === 'withBill' ? 'all' : 'withBill')} className={`w-full mt-2 text-sm font-semibold py-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:ring-green-500 ${filter === 'withBill' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                            {filter === 'withBill' ? 'Showing Bills' : 'View Bills'}
                        </button>
                    </StatCard>
                    <StatCard title="Without Bill" amount={withoutBillAmount} icon="fa-money-bill-wave" colorClass="blue">
                         <button onClick={() => setFilter(filter === 'withoutBill' ? 'all' : 'withoutBill')} className={`w-full mt-2 text-sm font-semibold py-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:ring-blue-500 ${filter === 'withoutBill' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}>
                            {filter === 'withoutBill' ? 'Showing Without Bill' : 'View Without Bill'}
                        </button>
                    </StatCard>
                    <StatCard title="Travel Charges" amount={travelChargesAmount} icon="fa-route" colorClass="cyan" description="Total spent on travel" />
                </div>

                <BalanceCard balance={remainingBalance} />

                <div className="my-8 flex justify-center">
                    <button onClick={handleOpenAddTransactionModal} className="w-full md:w-auto bg-indigo-600 text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-indigo-700 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 focus-visible:ring-indigo-500">
                         <i className="fas fa-plus-circle"></i> Add New Transaction
                    </button>
                </div>
                
                <ActionButtons 
                    onReset={handleReset} 
                    onDeleteAll={handleDeleteAllTransactions}
                    onExport={handleExport} 
                    onImport={handleImport}
                    onPrintAll={handlePrintAll}
                    onPrintSummary={() => handleSummaryReport('print')}
                    onDownloadAll={handleDownloadAll}
                    onDownloadSummary={() => handleSummaryReport('download')}
                    onDownloadBills={handleDownloadAllBills}
                    onAnalyze={handleAnalyze} 
                    hasTransactions={transactions.length > 0}
                    hasBills={Object.keys(bills).length > 0}
                    isAiEnabled={isAiEnabled} 
                />
                <TransactionFilters
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    customerFilter={customerFilter}
                    setCustomerFilter={setCustomerFilter}
                    purposeFilter={purposeFilter}
                    setPurposeFilter={setPurposeFilter}
                    customers={uniqueCustomers}
                    purposes={uniquePurposes}
                    onClearFilters={handleClearFilters}
                />
                <TransactionTable 
                    transactions={sortedTransactions} 
                    bills={bills}
                    filter={filter}
                    onView={handleViewTransaction}
                    onEdit={handleEditTransaction} 
                    onDelete={handleDelete}
                    onUploadBill={setUploadingBillFor}
                    onViewBill={handleViewBill}
                    onPrintBill={handlePrintBill}
                    onRemoveBill={handleRemoveBill}
                />
            </div>
            
            <TransactionForm 
                isOpen={isTransactionModalOpen}
                onClose={handleCloseTransactionModal}
                onAddOrUpdateTransaction={handleAddOrUpdateTransaction} 
                editingTransaction={editingTransaction} 
                validPurposes={validPurposes} 
                validShops={validShops}
            />
            <ViewTransactionModal transaction={viewingTransaction} onClose={() => setViewingTransaction(null)} />
            {uploadingBillFor && <BillUploadModal transaction={uploadingBillFor} onSaveBill={handleSaveBill} onClose={() => setUploadingBillFor(null)} />}
            <AiAnalysisModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} analysis={aiAnalysis} isLoading={isAiLoading} error={aiError} />
            <PrintPreviewModal 
                isOpen={isPrintPreviewOpen} 
                onClose={handleClosePrintPreview} 
                pdfUrl={pdfObjectUrl} 
                title={printPreviewTitle} 
            />
            <ConfirmationModal
                isOpen={confirmationState.isOpen}
                onClose={closeConfirmationModal}
                onConfirm={confirmationState.onConfirm}
                title={confirmationState.title}
                message={confirmationState.message}
            />
            <ScrollToTopButton />
            <div className="fixed top-5 right-5 z-50 space-y-2 w-80">
                {toasts.map(toast => <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />)}
            </div>
            <footer className="text-center p-4 mt-8 text-slate-500 text-sm">
                <span>© {new Date().getFullYear()} SSSHEP ExpensePro | Powered by SSSHEP</span>
                <span className="block sm:inline sm:ml-1 sm:pl-1 sm:border-l sm:border-slate-300 mt-1 sm:mt-0">
                    Developed by <span className="font-semibold text-slate-600">GSM</span>
                </span>
            </footer>
        </div>
    );
};

export default App;
