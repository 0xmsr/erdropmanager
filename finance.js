document.addEventListener('DOMContentLoaded', () => {
    const transactionForm = document.getElementById('transaction-form');
    const transactionList = document.getElementById('transaction-list');
    const totalIncomeEl = document.getElementById('total-income');
    const totalExpenseEl = document.getElementById('total-expense');
    const netBalanceEl = document.getElementById('net-balance');
    const transactionDescInput = document.getElementById('transaction-desc');
    const transactionAmountInput = document.getElementById('transaction-amount');
    const transactionTypeInput = document.getElementById('transaction-type');
    const transactionNetworkInput = document.getElementById('transaction-network');
    const customAlertOverlay = document.getElementById('custom-alert-overlay');
    const customAlertMessage = document.getElementById('custom-alert-message');
    const customAlertOkBtn = document.getElementById('custom-alert-ok-btn');
    const customConfirmOverlay = document.getElementById('custom-confirm-overlay');
    const customConfirmMessage = document.getElementById('custom-confirm-message');
    const customConfirmYesBtn = document.getElementById('custom-confirm-yes-btn');
    const customConfirmNoBtn = document.getElementById('custom-confirm-no-btn');
    let confirmResolver;

    let transactions = JSON.parse(localStorage.getItem('transactions')) || [];

    function showAlert(message) {
        customAlertMessage.textContent = message;
        customAlertOverlay.classList.remove('custom-modal-hidden');
    }

    customAlertOkBtn.addEventListener('click', () => {
        customAlertOverlay.classList.add('custom-modal-hidden');
    });

    function showConfirm(message) {
        customConfirmMessage.textContent = message;
        customConfirmOverlay.classList.remove('custom-modal-hidden');
        return new Promise(resolve => {
            confirmResolver = resolve;
        });
    }

    customConfirmYesBtn.addEventListener('click', () => {
        if (confirmResolver) {
            customConfirmOverlay.classList.add('custom-modal-hidden');
            confirmResolver(true);
        }
    });

    customConfirmNoBtn.addEventListener('click', () => {
        if (confirmResolver) {
            customConfirmOverlay.classList.add('custom-modal-hidden');
            confirmResolver(false);
        }
    });

    function saveTransactions() {
        localStorage.setItem('transactions', JSON.stringify(transactions));
    }

    function renderTransactions() {
        transactionList.innerHTML = '';
        let totalIncome = 0;
        let totalExpense = 0;

        if (transactions.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="6" style="text-align: center;">Belum ada transaksi</td>`;
            transactionList.appendChild(row);
        } else {
            transactions.forEach(transaction => {
                if (transaction.type === 'income') {
                    totalIncome += transaction.amount;
                } else {
                    totalExpense += transaction.amount;
                }

                const row = document.createElement('tr');
                const rowTypeClass = transaction.type === 'income' ? 'income-row' : 'expense-row';
                row.classList.add(rowTypeClass);
                row.innerHTML = `
                    <td>${transaction.date}</td>
                    <td>${transaction.desc}</td>
                    <td>${transaction.network || '-'}</td>
                    <td>${transaction.type === 'income' ? 'Pendapatan' : 'Pengeluaran'}</td>
                    <td>$${transaction.amount.toFixed(2)}</td>
                    <td>
                        <button class="action-btn delete-btn delete-transaction-btn" data-id="${transaction.id}">Hapus</button>
                    </td>
                `;
                transactionList.appendChild(row);
            });
        }

        const netBalance = totalIncome - totalExpense;

        totalIncomeEl.textContent = `$${totalIncome.toFixed(2)}`;
        totalExpenseEl.textContent = `$${totalExpense.toFixed(2)}`;
        netBalanceEl.textContent = `$${netBalance.toFixed(2)}`;
        
        if (netBalance < 0) {
            netBalanceEl.style.color = '#ff3333';
        } else if (netBalance > 0) {
            netBalanceEl.style.color = '#33ff33';
        } else {
            netBalanceEl.style.color = '#01a2ff'; 
        }
    }

    function handleTransactionSubmit(e) {
        e.preventDefault();

        const desc = transactionDescInput.value.trim();
        const amount = parseFloat(transactionAmountInput.value);
        const type = transactionTypeInput.value;
        const network = transactionNetworkInput.value;
        
        if (!desc || isNaN(amount) || amount <= 0 || !network) {
            showAlert('Deskripsi, Network, dan Jumlah (harus angka positif) tidak boleh kosong.');
            return;
        }

        const now = new Date();
        const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;

        const newTransaction = {
            id: Date.now(),
            desc: desc,
            amount: amount,
            type: type,
            network: network,
            date: formattedDate
        };

        transactions.push(newTransaction);
        saveTransactions();
        renderTransactions();
        transactionForm.reset();
    }

    async function handleTransactionDelete(e) {
        if (e.target.classList.contains('delete-transaction-btn')) {
            const id = parseInt(e.target.dataset.id);
            const confirmed = await showConfirm('Apakah Anda yakin ingin menghapus transaksi ini?');
            if (confirmed) {
                transactions = transactions.filter(transaction => transaction.id !== id);
                saveTransactions();
                renderTransactions();
            }
        }
    }

    transactionForm.addEventListener('submit', handleTransactionSubmit);
    transactionList.addEventListener('click', handleTransactionDelete);

    renderTransactions();
});