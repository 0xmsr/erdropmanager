document.addEventListener('DOMContentLoaded', () => {
    const faucetListContainer = document.getElementById('faucet-list');
    const searchInput = document.getElementById('search-faucet');

    const faucets = [
        {
            name: 'Giwa Sepolia',
            description: 'Dapatkan ETH testnet di jaringan Giwa Sepolia',
            url: 'https://faucet.paradigm.xyz/',
            urlText: 'Kunjungi faucet.giwa.io'
        },
        {
            name: 'Multi-Chain Faucet (Paradigm)',
            description: 'Faucet dari Paradigm yang mendukung banyak jaringan testnet. Memerlukan login via Twitter.',
            url: 'https://faucet.paradigm.xyz/',
            urlText: 'Kunjungi faucet.paradigm.xyz'
        },
        {
            name: 'QuickNode Faucet',
            description: 'Faucet dari QuickNode yang mendukung banyak jaringan EVM termasuk Sepolia, Goerli, dan lainnya.',
            url: 'https://faucet.quicknode.com/drip',
            urlText: 'Kunjungi faucet.quicknode.com'
        },
        {
            name: 'Sepolia ETHt',
            description: 'Beberapa pilihan faucet untuk jaringan testnet Sepolia Ethereum.',
            url: 'https://sepoliafaucet.com/',
            urlText: 'Kunjungi alchemy.com'
        },
        {
            name: 'Holesky ETH',
            description: 'Faucet untuk jaringan testnet Holesky Ethereum, pengganti Goerli.',
            url: 'https://holeskyfaucet.io/',
            urlText: 'Kunjungi holeskyFaucet.io'
        },
        {
            name: 'Goerli ETH',
            description: 'Kumpulan faucet untuk jaringan testnet Goerli Ethereum (mulai ditinggalkan).',
            url: 'https://goerlifaucet.com/',
            urlText: 'Kunjungi goerliFaucet.com'
        },
        {
            name: 'Mumbai (Polygon)',
            description: 'Dapatkan token MATIC testnet untuk jaringan Mumbai (Polygon).',
            url: 'https://faucet.polygon.technology/',
            urlText: 'Kunjungi Polygon Faucet'
        },
        {
            name: 'BNB Testnet',
            description: 'Faucet resmi dari Binance Smart Chain untuk mendapatkan tBNB untuk testnet.',
            url: 'https://testnet.binance.org/faucet-smart',
            urlText: 'Kunjungi BNB Faucet'
        },
        {
            name: 'Base Goerli',
            description: 'Dapatkan ETH testnet di jaringan Base Goerli dari QuickNode.',
            url: 'https://faucet.quicknode.com/base/goerli',
            urlText: 'Kunjungi Base Faucet'
        },
        {
            name: 'Arbitrum Sepolia',
            description: 'Dapatkan ETH testnet di jaringan Arbitrum Sepolia.',
            url: 'https://faucet.triangleplatform.com/arbitrum/sepolia',
            urlText: 'Kunjungi Arbitrum Faucet'
        }
    ];

    /**
     * @param {Array} faucetArray
     */

    function renderFaucets(faucetArray) {
        faucetListContainer.innerHTML = '';

        if (faucetArray.length === 0) {
            faucetListContainer.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">Tidak ada faucet yang cocok dengan pencarian Anda.</p>';
            return;
        }

        faucetArray.forEach(faucet => {
            const faucetItem = document.createElement('div');
            faucetItem.className = 'faucet-item';
            faucetItem.innerHTML = `
                <h3>${faucet.name}</h3>
                <p>${faucet.description}</p>
                <a href="${faucet.url}" target="_blank" rel="noopener noreferrer" class="open-link">${faucet.urlText}</a>
            `;
            faucetListContainer.appendChild(faucetItem);
        });
    }

    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const filteredFaucets = faucets.filter(faucet => 
            faucet.name.toLowerCase().includes(searchTerm) || 
            faucet.description.toLowerCase().includes(searchTerm)
        );
        renderFaucets(filteredFaucets);
    });

    renderFaucets(faucets);

});
