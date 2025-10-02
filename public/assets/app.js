const SCORE = 'score';
const DATE = 'date';

new Vue({
    el: '#report',
    data: {
        projects: [],
        projectsData: {},
        sortBy: SCORE,
        SCORE,
        DATE,
        prefix: window.location.hash ? window.location.hash.slice(1) : 'algojs',
        prefixes: [],
    },
    watch: {
        prefix() {
            window.location.hash = `#${this.prefix}`;
        }
    },
    mounted() {
        this.getData();
        setInterval(this.getData, 5000);
        addEventListener('hashchange', (event) => {
            this.prefix = window.location.hash.slice(1);
            this.getData();
        });
    },
    computed: {
        projectsSorted() {
            return this.projects.map((name) => {
                const p = {
                    name,
                    score: -1
                }
                if (this.projectsData.hasOwnProperty(name) && !this.projectsData[name].hasOwnProperty('lint')) {
                    p.data = this.projectsData[name]
                    // handle pytest data
                    if (p.data.summary) {
                        p.data.stats = {
                            passes: p.data.summary.passed || 0,
                            start: Math.round(p.data.created)*1000,
                            failures: p.data.summary.failed || 0,
                            tests: p.data.summary.total,
                        }
                    }
                    p.detailUrl = `results/${p.name}/`;
                    p.score = p.data.stats.passes;
                }
                if (this.projectsData.hasOwnProperty(name) && this.projectsData[name].hasOwnProperty('lint')) {
                    p.detailUrl = `results/${p.name}/lint.log`;
                    const matchE = this.projectsData[name].lint.match(/(\d+) error/)
                    const matchW = this.projectsData[name].lint.match(/(\d+) warning/)
                    p.data = {
                        stats: {
                            failures: 0,
                            passes: 0
                        }
                    }
                    p.score = 0
                    if (matchE) {
                        p.data.stats.failures = parseInt(matchE[1])
                        p.score = p.data.stats.failures
                    }
                    if (matchW) {
                        p.data.stats.passes = parseInt(matchW[1])
                        p.score += p.data.stats.passes
                    }
                }
                return p;
            }).sort((a, b) => {
                if (this.sortBy === SCORE) {
                    const deltaScore = b.score - a.score;
                    if (deltaScore === 0 && a.data && b.data) {
                        return moment(a.data.stats.start).isBefore(b.data.stats.start) ? -1 : 1;
                    } else if (deltaScore === 0) {
                        return a.name.localeCompare(b.name);
                    }
                    return deltaScore;
                } else if (this.sortBy === DATE) {
                    if (a.data && b.data) {
                        return moment(a.data.stats.start).isBefore(b.data.stats.start) ? 1 : -1;
                    } else if (a.data) {
                        return -1;
                    } else if (b.data) {
                        return 1;
                    }
                    return a.name.localeCompare(b.name);
                }
                return 0;
            });
        }
    },
    filters: {
        fromNow(date) {
            return moment(date).fromNow()
        }
    },
    methods: {
        setTitle() {
            document.title = `Exercice - ${this.prefix}`;
        },
        getData() {
            this.setTitle();
            fetch('/api/results').then(r => r.json()).then(r => {
                this.prefixes = r.reduce((acc, name) => {
                    const prefix = name.split('-')[0];
                    if (!acc.includes(prefix)) {
                        acc.push(prefix);
                    }
                    return acc;
                }, []);
                this.projects = r.filter(name => name.startsWith(this.prefix));
                this.projects.forEach(this.fetchProject);
            });
        },
        fetchProject(name) {
            fetch(`/results/${name}/report.json`).then(r => r.json())
                .then(r => {
                    this.$set(this.projectsData, name, r);
                })
                .catch(e => {

                });
        },
        hsl(p) {
            if (!p.data || !p.data.stats) return "";
            const value = p.data.stats.passes / p.data.stats.tests;
            const hue = (value * 90).toString(10);
            return ["background-color: hsl(", hue, ", 90%,60%)"].join("");
        }
    }
})
