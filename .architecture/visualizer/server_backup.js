// Backup of the hierarchy query before modification
case 'hierarchy':
    query = `
        WITH RECURSIVE tree AS (
            SELECT *, 0 as level, name as path, 
                   CASE WHEN parent_id IS NULL THEN id ELSE NULL END as root_id,
                   ROW_NUMBER() OVER (PARTITION BY parent_id ORDER BY type, name) as sibling_order
            FROM components WHERE parent_id IS NULL
            UNION ALL
            SELECT c.*, t.level + 1, t.path || '/' || c.name,
                   COALESCE(t.root_id, t.id) as root_id,
                   ROW_NUMBER() OVER (PARTITION BY c.parent_id ORDER BY c.type, c.name) as sibling_order
            FROM components c
            JOIN tree t ON c.parent_id = t.id
        ),
        level_counts AS (
            SELECT level, COUNT(*) as count, 
                   COUNT(DISTINCT parent_id) as parent_count
            FROM tree
            GROUP BY level
        )
        SELECT 
            'flowchart TB' as line, 0 as sort_order
        UNION ALL
        -- Create level subgraphs for better vertical organization
        SELECT DISTINCT
            printf('subgraph level%s["Level %s"]', level, level),
            level * 10000 + 1
        FROM tree
        WHERE level <= 3  -- Only show first 4 levels as subgraphs
        UNION ALL
        -- Create sub-subgraphs within levels to group siblings
        SELECT DISTINCT
            printf('    subgraph sub%s_%s[" "]', 
                parent_id, 
                CASE 
                    WHEN COUNT(*) OVER (PARTITION BY parent_id) > 6 
                    THEN (sibling_order - 1) / 3  -- Group every 3 components if more than 6 siblings
                    ELSE 0 
                END),
            parent_id * 100 + (sibling_order - 1) / 3 + level * 10000 + 10
        FROM tree
        WHERE parent_id IS NOT NULL 
        AND level <= 3  -- Only group components in first 4 levels
        GROUP BY parent_id, (sibling_order - 1) / 3, level
        UNION ALL
        -- Add nodes, grouped when they have many siblings
        SELECT 
            CASE 
                WHEN level <= 3 THEN
                    printf('        %s["%s"]:::%s', 
                        REPLACE(name, '-', '_'), 
                        SUBSTR(name, 1, 20) || CASE WHEN LENGTH(name) > 20 THEN '...' ELSE '' END,
                        CASE 
                            WHEN type = 'module' THEN 'module'
                            WHEN type = 'function' THEN 'function'
                            WHEN parent_id IS NULL THEN 'rootNode'
                            ELSE 'default'
                        END)
                ELSE
                    printf('    %s["%s"]:::%s', 
                        REPLACE(name, '-', '_'), 
                        SUBSTR(name, 1, 20) || CASE WHEN LENGTH(name) > 20 THEN '...' ELSE '' END,
                        CASE 
                            WHEN type = 'module' THEN 'module'
                            WHEN type = 'function' THEN 'function'
                            ELSE 'default'
                        END)
            END,
            id * 10 + level * 10000 + 100 + sibling_order
        FROM tree
        UNION ALL
        -- Close sub-subgraphs
        SELECT DISTINCT
            '    end',
            parent_id * 100 + (sibling_order - 1) / 3 + level * 10000 + 90
        FROM tree
        WHERE parent_id IS NOT NULL 
        AND level <= 3
        GROUP BY parent_id, (sibling_order - 1) / 3, level
        UNION ALL
        -- Close level subgraphs
        SELECT DISTINCT 'end', level * 10000 + 9999
        FROM tree
        WHERE level <= 3
        UNION ALL
        -- Add relationships with better routing
        SELECT 
            CASE
                WHEN ABS(c.level - p.level) > 1 THEN
                    printf('    %s -.-> %s', 
                        REPLACE(p.name, '-', '_'),
                        REPLACE(c.name, '-', '_'))
                ELSE
                    printf('    %s --> %s', 
                        REPLACE(p.name, '-', '_'),
                        REPLACE(c.name, '-', '_'))
            END,
            c.id * 10 + 500000 + c.level * 100
        FROM tree c
        JOIN tree p ON c.parent_id = p.id
        WHERE c.parent_id IS NOT NULL
        UNION ALL
        -- Style definitions
        SELECT 'classDef rootNode fill:#2E7D32,stroke:#1B5E20,stroke-width:3px,color:#fff,font-weight:bold', 999996
        UNION ALL
        SELECT 'classDef module fill:#4CAF50,stroke:#2E7D32,stroke-width:2px,color:#fff', 999997
        UNION ALL
        SELECT 'classDef function fill:#81C784,stroke:#388E3C,stroke-width:1px', 999998
        UNION ALL
        SELECT 'classDef default fill:#e1f5fe,stroke:#0288d1,stroke-width:1px', 999999
        ORDER BY sort_order
    `;
    break;