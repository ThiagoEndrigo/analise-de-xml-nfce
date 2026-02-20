// Worker para processamento pesado - Versão com detecção automática de intervalo
console.log('✅ Worker iniciado - Versão com detecção automática de intervalo');

// Sistema de log
const log = {
    erros: [],
    avisos: [],
    info: []
};

// Função para parsear XML sem DOMParser
function parseXML(xmlString) {
    try {
        if (typeof DOMParser !== 'undefined') {
            const parser = new DOMParser();
            return parser.parseFromString(xmlString, "text/xml");
        } else {
            return parseXMLManually(xmlString);
        }
    } catch (erro) {
        throw new Error(`Erro ao parsear XML: ${erro.message}`);
    }
}

// Parser manual para Web Worker
function parseXMLManually(xmlString) {
    const result = {
        querySelector: function(selector) {
            return findElement(xmlString, selector);
        },
        querySelectorAll: function(selector) {
            return findElements(xmlString, selector);
        }
    };
    return result;
}

function findElement(xmlString, selector) {
    const tags = selector.split(' ');
    let currentXml = xmlString;
    
    for (const tag of tags) {
        const match = currentXml.match(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 's'));
        if (!match) return null;
        currentXml = match[1];
    }
    
    return {
        textContent: currentXml,
        querySelector: (sel) => findElement(currentXml, sel)
    };
}

function findElements(xmlString, selector) {
    const matches = [];
    const regex = new RegExp(`<${selector}[^>]*>(.*?)</${selector}>`, 'gs');
    let match;
    
    while ((match = regex.exec(xmlString)) !== null) {
        matches.push({
            textContent: match[1],
            querySelector: (sel) => findElement(match[1], sel)
        });
    }
    
    return matches;
}

function compararValoresMonetarios(a, b, tolerancia = 0.009) {
    return Math.abs(a - b) <= tolerancia;
}

function getElementText(xmlDoc, seletor) {
    try {
        if (typeof xmlDoc.querySelector === 'function') {
            const elem = xmlDoc.querySelector(seletor);
            return elem ? elem.textContent : null;
        } else {
            const match = xmlDoc.match(new RegExp(`<${seletor}[^>]*>(.*?)</${seletor}>`, 's'));
            return match ? match[1].trim() : null;
        }
    } catch (erro) {
        return null;
    }
}

function validarEstruturaXML(xmlDoc, xmlString) {
    const estruturasValidas = [
        !!getElementText(xmlDoc, 'nfeProc NFe infNFe ide nNF'),
        !!getElementText(xmlDoc, 'NFe infNFe ide nNF'),
        !!getElementText(xmlDoc, 'infNFe ide nNF')
    ];
    
    return estruturasValidas.some(valida => valida === true);
}

// Função para extrair valores incluindo série
function extrairValoresXML(xmlDoc, xmlString, nomeArquivo) {
    let vNF = 0;
    let vPag = 0;
    let numero = null;
    let serie = null;
    let xNome = '';
    
    try {
        // Extrair número da nota
        const nNF = getElementText(xmlDoc, 'nNF') || 
                    getElementText(xmlDoc, 'ide nNF') ||
                    getElementText(xmlDoc, 'infNFe ide nNF') ||
                    getElementText(xmlDoc, 'NFe infNFe ide nNF') ||
                    getElementText(xmlDoc, 'nfeProc NFe infNFe ide nNF');
        
        if (nNF) {
            numero = parseInt(nNF, 10);
            if (isNaN(numero)) numero = null;
        }
        
        // Extrair série da nota
        const serieText = getElementText(xmlDoc, 'serie') || 
                         getElementText(xmlDoc, 'ide serie') ||
                         getElementText(xmlDoc, 'infNFe ide serie') ||
                         getElementText(xmlDoc, 'NFe infNFe ide serie') ||
                         getElementText(xmlDoc, 'nfeProc NFe infNFe ide serie');
        
        if (serieText) {
            serie = parseInt(serieText, 10);
            if (isNaN(serie)) serie = serieText;
        }
        
        // Extrair nome da empresa
        xNome = getElementText(xmlDoc, 'emit xNome') || 
                getElementText(xmlDoc, 'NFe infNFe emit xNome') ||
                getElementText(xmlDoc, 'nfeProc NFe infNFe emit xNome') ||
                getElementText(xmlDoc, 'infNFe emit xNome') ||
                '';
        
        // Extrair vNF
        const vNFText = getElementText(xmlDoc, 'vNF') || 
                        getElementText(xmlDoc, 'ICMSTot vNF') ||
                        getElementText(xmlDoc, 'total ICMSTot vNF') ||
                        getElementText(xmlDoc, 'infNFe total ICMSTot vNF');
        
        if (vNFText) {
            vNF = parseFloat(vNFText.replace(',', '.')) || 0;
        }
        
        // Extrair vPag
        const vPagRegex = /<vPag[^>]*>(.*?)<\/vPag>/gs;
        let match;
        while ((match = vPagRegex.exec(xmlString)) !== null) {
            vPag += parseFloat(match[1].replace(',', '.')) || 0;
        }
        
        if (vPag === 0) {
            const vPagText = getElementText(xmlDoc, 'detPag vPag') || 
                            getElementText(xmlDoc, 'pag vPag') ||
                            getElementText(xmlDoc, 'infNFe pag vPag');
            
            if (vPagText) {
                vPag = parseFloat(vPagText.replace(',', '.')) || 0;
            }
        }
        
    } catch (erro) {
        log.erros.push(`Arquivo ${nomeArquivo}: Erro ao extrair valores - ${erro.message}`);
    }
    
    return { numero, serie, vNF, vPag, xNome };
}

function verificarProtocoloNota(xmlDoc, xmlString) {
    try {
        const temProtNFe = xmlString.includes('<protNFe') || 
                          xmlString.includes('<protNFe>');
        
        if (!temProtNFe) {
            return {
                possuiProtocolo: false,
                completo: false,
                detalhes: null
            };
        }
        
        const cStat = getElementText(xmlDoc, 'cStat');
        const nProt = getElementText(xmlDoc, 'nProt');
        const xMotivo = getElementText(xmlDoc, 'xMotivo');
        const dhRecbto = getElementText(xmlDoc, 'dhRecbto');
        
        const possuiCamposEssenciais = !!(cStat && nProt);
        
        return {
            possuiProtocolo: true,
            completo: possuiCamposEssenciais,
            detalhes: {
                cStat: cStat || null,
                nProt: nProt || null,
                xMotivo: xMotivo || null,
                dhRecbto: dhRecbto || null
            }
        };
        
    } catch (erro) {
        return {
            possuiProtocolo: false,
            completo: false,
            detalhes: null,
            erro: erro.message
        };
    }
}

// Função para encontrar números faltantes em um intervalo
function encontrarFaltantes(numerosEncontrados) {
    if (numerosEncontrados.size === 0) return {
        faltantes: [],
        menorNumero: 0,
        maiorNumero: 0,
        totalIntervalo: 0,
        totalEncontrados: 0
    };
    
    // Converter Set para array e ordenar
    const numerosArray = Array.from(numerosEncontrados).sort((a, b) => a - b);
    
    // Encontrar menor e maior número
    const menorNumero = numerosArray[0];
    const maiorNumero = numerosArray[numerosArray.length - 1];
    
    console.log(`📊 Intervalo detectado: ${menorNumero} - ${maiorNumero}`);
    console.log(`📊 Total de números no intervalo: ${maiorNumero - menorNumero + 1}`);
    console.log(`📊 Números encontrados: ${numerosArray.length}`);
    
    // Criar um Set para busca rápida
    const numerosSet = new Set(numerosArray);
    const faltantes = [];
    
    // Verificar cada número no intervalo
    for (let i = menorNumero; i <= maiorNumero; i++) {
        if (!numerosSet.has(i)) {
            faltantes.push(i);
        }
    }
    
    console.log(`📊 Números faltantes: ${faltantes.length}`);
    
    return {
        faltantes: faltantes,
        menorNumero: menorNumero,
        maiorNumero: maiorNumero,
        totalIntervalo: maiorNumero - menorNumero + 1,
        totalEncontrados: numerosArray.length
    };
}

self.onmessage = function(e) {
    console.log('📥 Worker recebeu dados para processar');
    
    const { arquivos } = e.data;
    
    if (!arquivos || !Array.isArray(arquivos)) {
        self.postMessage({
            tipo: 'erro',
            mensagem: 'Dados inválidos recebidos pelo worker'
        });
        return;
    }
    
    console.log(`📊 Total de arquivos a processar: ${arquivos.length}`);
    
    log.erros = [];
    log.avisos = [];
    log.info = [];
    
    const resultados = {
        somaVNF: 0,
        somaVPag: 0,
        todosNumeros: new Set(), // Guarda TODOS os números encontrados
        divergencias: [],
        duplicatas: new Map(),
        duplicatasFallback: new Map(),
        chavesProcessadas: new Set(),
        chaveParaInfo: new Map(),
        numerosProcessados: new Set(),
        totalProcessado: 0,
        notasSemProtocolo: [],
        notasComProtocoloIncompleto: [],
        statusProtocolo: {
            total: 0,
            comProtocolo: 0,
            semProtocolo: 0,
            incompleto: 0
        },
        nomeEmitente: ''
    };
    
    const totalArquivos = arquivos.length;
    let primeiroArquivoComNome = true;
    
    // Processar todos os arquivos
    for (let i = 0; i < totalArquivos; i++) {
        const arquivo = arquivos[i];
        
        try {
            const { nome, conteudo } = arquivo;
            
            const xmlDoc = parseXML(conteudo);
            
            if (!validarEstruturaXML(xmlDoc, conteudo)) {
                log.avisos.push(`Arquivo ${nome}: Estrutura XML não reconhecida`);
                resultados.totalProcessado++;
                continue;
            }
            
            const { numero, serie, vNF, vPag, xNome } = extrairValoresXML(xmlDoc, conteudo, nome);
            
            // Armazenar o nome da empresa (pega o primeiro que encontrar)
            if (xNome && primeiroArquivoComNome) {
                resultados.nomeEmitente = xNome;
                primeiroArquivoComNome = false;
            }
            
            const protocolo = verificarProtocoloNota(xmlDoc, conteudo);
            resultados.statusProtocolo.total++;
            
            if (!protocolo.possuiProtocolo) {
                resultados.statusProtocolo.semProtocolo++;
                resultados.notasSemProtocolo.push({
                    numero: numero || 'Desconhecido',
                    arquivo: nome,
                    motivo: 'Protocolo de autorização não encontrado'
                });
            } else if (!protocolo.completo) {
                resultados.statusProtocolo.incompleto++;
                resultados.notasComProtocoloIncompleto.push({
                    numero: numero || 'Desconhecido',
                    arquivo: nome,
                    motivo: 'Protocolo incompleto',
                    detalhes: protocolo.detalhes
                });
            } else {
                resultados.statusProtocolo.comProtocolo++;
            }
            
            // Guardar número para cálculo de faltantes
            if (numero !== null) {
                resultados.todosNumeros.add(numero);
            }
            
            // CRIAR CHAVE COMPOSTA (série + número)
            const chaveComposta = serie && numero !== null ? `${serie}-${numero}` : null;
            
            // DETECÇÃO DE DUPLICATAS
            if (chaveComposta) {
                if (resultados.chavesProcessadas.has(chaveComposta)) {
                    if (!resultados.duplicatas.has(chaveComposta)) {
                        const primeiraInfo = resultados.chaveParaInfo.get(chaveComposta) || {};
                        resultados.duplicatas.set(chaveComposta, {
                            chave: chaveComposta,
                            numero: numero,
                            serie: serie,
                            arquivos: [primeiraInfo.primeiroArquivo || 'Arquivo anterior'],
                            xNome: primeiraInfo.xNome || xNome
                        });
                    }
                    
                    const duplicata = resultados.duplicatas.get(chaveComposta);
                    if (!duplicata.arquivos.includes(nome)) {
                        duplicata.arquivos.push(nome);
                    }
                    
                    log.avisos.push(`Série ${serie} - Nota ${numero} duplicada nos arquivos: ${duplicata.arquivos.join(', ')} (Empresa: ${xNome || 'N/I'})`);
                } else {
                    resultados.chavesProcessadas.add(chaveComposta);
                    resultados.chaveParaInfo.set(chaveComposta, {
                        numero: numero,
                        serie: serie,
                        xNome: xNome,
                        primeiroArquivo: nome
                    });
                }
            } else {
                if (numero !== null) {
                    if (resultados.numerosProcessados.has(numero)) {
                        if (!resultados.duplicatasFallback) {
                            resultados.duplicatasFallback = new Map();
                        }
                        
                        if (!resultados.duplicatasFallback.has(numero)) {
                            resultados.duplicatasFallback.set(numero, {
                                numero: numero,
                                serie: 'N/I',
                                arquivos: [],
                                xNome: xNome,
                                fallback: true
                            });
                        }
                        
                        const duplicataFallback = resultados.duplicatasFallback.get(numero);
                        if (!duplicataFallback.arquivos.includes(nome)) {
                            duplicataFallback.arquivos.push(nome);
                        }
                        
                        log.avisos.push(`Nota ${numero} (sem série) duplicada nos arquivos: ${duplicataFallback.arquivos.join(', ')}`);
                    } else {
                        resultados.numerosProcessados.add(numero);
                    }
                }
            }
            
            resultados.somaVNF += vNF;
            resultados.somaVPag += vPag;
            
            if (!compararValoresMonetarios(vNF, vPag)) {
                resultados.divergencias.push({
                    numero: numero || 'Desconhecido',
                    arquivo: nome,
                    vNF: vNF,
                    vPag: vPag,
                    diferenca: vNF - vPag,
                    status: vNF > vPag ? 'vNF MAIOR' : 'vPag MAIOR',
                    possuiProtocolo: protocolo.possuiProtocolo
                });
            }
            
            resultados.totalProcessado++;
            
        } catch (erro) {
            log.erros.push(`Arquivo ${arquivo.nome}: ${erro.message}`);
            resultados.totalProcessado++;
        }
        
        // Enviar progresso a cada 100 arquivos ou no final
        if ((i + 1) % 100 === 0 || i === totalArquivos - 1) {
            const percentual = Math.floor(((i + 1) / totalArquivos) * 100);
            
            self.postMessage({
                tipo: 'progresso',
                progresso: percentual,
                processados: i + 1,
                total: totalArquivos,
                status: `Processando... (${i + 1}/${totalArquivos})`
            });
        }
    }
    
    // Calcular números faltantes baseado em TODOS os números encontrados
    const resultadoFaltantes = encontrarFaltantes(resultados.todosNumeros);
    
    // Combinar duplicatas normais com fallback
    const todasDuplicatas = [
        ...Array.from(resultados.duplicatas.entries()).map(([chave, dados]) => {
            if (!dados.arquivos || dados.arquivos.length === 0) {
                dados.arquivos = ['Arquivo não identificado'];
            }
            return {
                chave: chave,
                numero: dados.numero,
                serie: dados.serie,
                arquivos: dados.arquivos,
                xNome: dados.xNome,
                tipo: 'normal'
            };
        }),
        ...Array.from(resultados.duplicatasFallback?.entries() || []).map(([numero, dados]) => {
            if (!dados.arquivos || dados.arquivos.length === 0) {
                dados.arquivos = ['Arquivo não identificado'];
            }
            return {
                chave: `fallback-${numero}`,
                numero: numero,
                serie: 'N/I',
                arquivos: dados.arquivos,
                xNome: dados.xNome,
                tipo: 'fallback'
            };
        })
    ];
    
    console.log('📊 RESULTADO FINAL:');
    console.log(`   Menor número: ${resultadoFaltantes.menorNumero}`);
    console.log(`   Maior número: ${resultadoFaltantes.maiorNumero}`);
    console.log(`   Total no intervalo: ${resultadoFaltantes.totalIntervalo}`);
    console.log(`   Encontrados: ${resultadoFaltantes.totalEncontrados}`);
    console.log(`   Faltantes: ${resultadoFaltantes.faltantes.length}`);
    console.log(`   Duplicatas: ${todasDuplicatas.length}`);
    
    self.postMessage({
        tipo: 'completo',
        resultados: {
            somaVNF: resultados.somaVNF,
            somaVPag: resultados.somaVPag,
            divergencias: resultados.divergencias,
            duplicatas: todasDuplicatas,
            faltantes: resultadoFaltantes.faltantes,
            totalProcessado: resultados.totalProcessado,
            notasSemProtocolo: resultados.notasSemProtocolo,
            notasComProtocoloIncompleto: resultados.notasComProtocoloIncompleto,
            statusProtocolo: resultados.statusProtocolo,
            nomeEmitente: resultados.nomeEmitente || 'Não identificado',
            diferencaTotal: resultados.somaVNF - resultados.somaVPag,
            metadados: {
                menorNumero: resultadoFaltantes.menorNumero,
                maiorNumero: resultadoFaltantes.maiorNumero,
                totalIntervalo: resultadoFaltantes.totalIntervalo,
                totalEncontrados: resultadoFaltantes.totalEncontrados
            },
            estatisticasDuplicatas: {
                total: todasDuplicatas.length,
                comSerie: resultados.duplicatas.size,
                semSerie: resultados.duplicatasFallback?.size || 0
            },
            porcentagemComProtocolo: resultados.statusProtocolo.total > 0 ? 
                ((resultados.statusProtocolo.comProtocolo / resultados.statusProtocolo.total) * 100).toFixed(1) : '0.0',
            todasTemProtocolo: resultados.statusProtocolo.semProtocolo === 0,
            log: {
                erros: log.erros,
                avisos: log.avisos,
                info: log.info
            }
        }
    });
};

self.onerror = function(erro) {
    console.error('❌ Erro no worker:', erro);
    self.postMessage({
        tipo: 'erro',
        mensagem: erro.message || 'Erro desconhecido no worker'
    });
};