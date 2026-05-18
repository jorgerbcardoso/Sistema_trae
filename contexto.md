PROMPT INICIAL PARA IA:
Este é meu sistema de gestão para transportadoras. Ele já está bem completo.
Ele é um projeto react/vite com backend em PHP
O backend se encontra aqui, também, e eu vou solicitar que você faça ocasionais alterações nele.
O fluxo é sempre um push total para meu repositório git. Depois, no meu serv linux debian eu rodo o script deploy.sh (ele está neste projeto também).
O script deploy.sh faz o pull completo do git e depois faz o build no meu servidor.
Todas as definições e regras que você precisa saber para efetuar as operações estão nos arquivos CHECKLIST_TELAS.md, PADROES_CODIGO.md, REGRAS_DESENVOLVIMENTO.md e pre_manual_estoque.md. O arquivo REGRAS_DESENVOLVIMENTO.md contém as diretrizes críticas sobre a exibição de logotipos em relatórios (PDF e Excel), especialmente a regra de exclusão da logo Presto para o domínio ACV.
Importante: após cada alteração, nunca faça o build, nem rode o servidor após suas operações. Não quero gastar créditos de IA com isso. Eu mesmo executarei os comandos manualmente.
Quanto a base de dados: temos algumas tabelas centrais (users, domains, menu_items) mas a maioria delas é identicada com um prefixo no nome. Este prefixo é o dominio de cada cliente meu.
Exemplo: a tabela de setores do domínio ACV se chama acv_setores
Eu sempre passarei orientação a você me referindo às tabelas dessa forma: [dominio]_setores (no caso da tabela de setores)
REGRA IMPORTANTE: caso eu passe um prompt pra ti que vai demandar muitas buscas em vários arquivos, não saia fazendo múltiplas buscas. antes disso, me informe o que vc está procurando para que eu te caminhos mais específicos.


COMO ADICIONAR UMA NOVA TELA/FUNCIONALIDADE (RESUMO PRÁTICO):

1) FRONTEND (React/Vite)
- Crie o componente em: src/components/<secao>/<NomeDaTela>.tsx (ou src/pages quando for o padrão daquele módulo)
- Se for tela de cadastros/admin: usar <AdminLayout title="..." description="...">
- Registre a rota em src/routes.tsx (ex: path: 'cadastros/unidades')
- Registre o component_path em src/components/ComponentRegistry.tsx (ex: 'cadastros/CadastroUnidades')

2) BANCO (MENU)
- A rota salva no banco PRECISA começar com "/" (ex: "/cadastros/unidades"). Se vier sem "/", o clique no menu pode gerar navegação relativa (ex: /menu/cadastros/unidades) e cair no fallback, voltando pro menu.
- O component_path salvo no banco NÃO começa com "/" e precisa bater com a chave do ComponentRegistry (ex: "cadastros/CadastroUnidades").
- Além de inserir em menu_items, o item precisa estar liberado para o domínio em domain_menu_items (senão não aparece no menu do usuário).

3) BACKEND (PHP)
- Cadastros costumam ficar em: src/api/cadastros/
- Importações SSW seguem o padrão de: src/api/eventos/import_eventos.php (require_ssw + ask() + imp_ssw_*)
