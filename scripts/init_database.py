"""
Academic Joan of Arc — 数据库初始化与种子数据填充脚本
用法: python scripts/init_database.py
"""

import os
import sys
import json
import sqlite3
import random
from datetime import datetime, timedelta

# 项目根目录
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_DIR = os.path.join(ROOT_DIR, "data")
DB_PATH = os.path.join(DB_DIR, "ai_scientist.db")
SCHEMA_PATH = os.path.join(ROOT_DIR, "database", "schema.sql")
KG_SEED_PATH = os.path.join(ROOT_DIR, "datasets", "astronomy_kg_seed.json")


def init_schema():
    """初始化数据库表结构"""
    os.makedirs(DB_DIR, exist_ok=True)

    if os.path.exists(DB_PATH):
        print(f"[INFO] 数据库已存在: {DB_PATH}")
        return

    print(f"[INFO] 创建数据库: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    with open(SCHEMA_PATH, "r", encoding="utf-8") as f:
        conn.executescript(f.read())
    conn.close()
    print("[OK] 表结构初始化完成 (11张表)")


def init_users():
    """创建默认用户"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] > 0:
        print("[SKIP] 用户已存在")
        conn.close()
        return

    # 使用 SHA-256 哈希（兼容 bcrypt 4.x）
    import hashlib
    admin_hash = hashlib.sha256(b"admin123").hexdigest()
    researcher_hash = hashlib.sha256(b"researcher123").hexdigest()

    cursor.execute(
        "INSERT INTO users (username, password_hash, email, research_field) VALUES (?, ?, ?, ?)",
        ("admin", admin_hash, "admin@ajoa.local", "天文物理"),
    )
    cursor.execute(
        "INSERT INTO users (username, password_hash, email, research_field) VALUES (?, ?, ?, ?)",
        ("researcher", researcher_hash, "researcher@ajoa.local", "天文物理"),
    )
    conn.commit()
    conn.close()
    print("[OK] 默认用户: admin/admin123, researcher/researcher123")


def init_knowledge_graph():
    """导入知识图谱种子数据"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM kg_nodes")
    if cursor.fetchone()[0] > 0:
        print("[SKIP] 知识图谱已有数据")
        conn.close()
        return

    if not os.path.exists(KG_SEED_PATH):
        print(f"[WARN] 种子文件不存在: {KG_SEED_PATH}")
        conn.close()
        return

    with open(KG_SEED_PATH, "r", encoding="utf-8") as f:
        seed = json.load(f)

    # 插入节点
    node_id_map = {}
    for i, node in enumerate(seed["nodes"]):
        cursor.execute(
            "INSERT INTO kg_nodes (label, type, properties, source) VALUES (?, ?, ?, ?)",
            (node["label"], node["type"], json.dumps(node.get("properties", {}), ensure_ascii=False), "seed"),
        )
        node_id_map[node["label"]] = cursor.lastrowid

    # 插入关系
    for edge in seed["edges"]:
        source_id = node_id_map.get(edge["source"])
        target_id = node_id_map.get(edge["target"])
        if source_id and target_id:
            cursor.execute(
                "INSERT INTO kg_edges (source_id, target_id, relation_type, confidence, evidence) VALUES (?, ?, ?, ?, ?)",
                (source_id, target_id, edge["relation_type"], edge.get("confidence", 1.0), edge.get("evidence", "")),
            )

    conn.commit()
    conn.close()
    print(f"[OK] 知识图谱: {len(seed['nodes'])}节点, {len(seed['edges'])}关系")


def init_astro_data():
    """生成模拟天文数据（基于JW-SSD格式）"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM astro_data")
    if cursor.fetchone()[0] > 0:
        print("[SKIP] 天文数据已存在")
        conn.close()
        return

    random.seed(42)
    magnetic_types = ["alpha", "beta", "beta-gamma", "beta-gamma-delta"]
    flare_classes = ["A", "B", "C", "M", "X"]
    flare_weights = [0.3, 0.3, 0.25, 0.1, 0.05]  # X级耀斑罕见

    base_time = datetime(2023, 1, 1)
    records = []

    for i in range(500):
        obs_time = base_time + timedelta(hours=i * 12, minutes=random.randint(0, 59))
        noaa = f"AR{random.randint(13000, 13500)}"
        mag_type = random.choice(magnetic_types)

        # 复杂磁场类型更容易产生强耀斑
        complexity_bonus = magnetic_types.index(mag_type) * 0.15
        shear = random.gauss(30 + complexity_bonus * 40, 12)
        twist = random.gauss(0.5 + complexity_bonus, 0.3)
        gradient = random.gauss(0.02 + complexity_bonus * 0.03, 0.008)

        # 耀斑等级与磁参数相关
        flare_prob = min(0.9, 0.2 + shear / 100 + twist / 3 + complexity_bonus)
        if random.random() < flare_prob:
            flare_class = random.choices(flare_classes, weights=flare_weights)[0]
        else:
            flare_class = "A"

        records.append((
            "JW-SSD", obs_time.isoformat(), noaa, mag_type,
            round(max(0, shear), 2), round(max(0, twist), 4),
            round(max(0, gradient), 5), flare_class, None,
            json.dumps({"quality": "good", "instrument": "HMI"}),
        ))

    cursor.executemany(
        """INSERT INTO astro_data
           (data_source, obs_time, noaa_number, magnetic_type,
            shear_angle, twist_degree, magnetic_gradient, flare_class,
            raw_data_path, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        records,
    )
    conn.commit()
    conn.close()
    print(f"[OK] 天文数据: {len(records)}条记录 (JW-SSD格式)")


def init_literature():
    """插入示例文献数据"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM literature")
    if cursor.fetchone()[0] > 0:
        print("[SKIP] 文献数据已存在")
        conn.close()
        return

    papers = [
        ("2401.12345", "10.1088/1674-4527/ad1234", "Deep Learning for Solar Flare Prediction: A Comprehensive Review",
         "Zhang Y, Li M, Wang H", "本文综述了2018-2024年间深度学习方法在太阳耀斑预测中的应用进展...",
         "2024-01-15", "astro-ph.SR", 45),
        ("2312.09876", "10.3847/1538-4357/ad0987", "Magnetic Free Energy and Flare Productivity in Active Regions",
         "Chen L, Liu R", "基于SDO/HMI矢量磁场数据，我们计算了157个活动区的自由磁能...",
         "2023-12-20", "astro-ph.SR", 32),
        ("2311.05432", "10.1093/mnras/stad3456", "Flux Rope Formation and Eruption: Observations and MHD Simulations",
         "Wang J, Zhang Q, Li X", "通过高分辨MHD模拟和SDO多波段观测对比，研究了磁通量绳的形成...",
         "2023-11-08", "astro-ph.SR", 28),
        ("2310.08765", "10.1029/2023SW003456", "Real-time Flare Forecasting Using Magnetogram-derived Features",
         "Park S, Kim J", "提出了一种基于实时磁图特征提取的耀斑预报框架...",
         "2023-10-12", "physics.space-ph", 19),
        ("2309.04321", "10.1051/0004-6361/202347890", "Statistical Study of Magnetic Shear Angle as Flare Precursor",
         "Liu H, Tan C", "对2010-2023年间1200个活动区的磁剪切角演化进行统计分析...",
         "2023-09-05", "astro-ph.SR", 37),
        ("2308.07654", "10.1109/TGRS.2023.3301234", "Transformer-based Multi-wavelength Fusion for CME Detection",
         "Zhao W, Sun Y", "提出了一种基于Transformer的多波段融合CME检测方法...",
         "2023-08-18", "astro-ph.IM", 22),
        ("2307.02345", "10.1007/s11207-023-02178-9", "Causal Discovery in Solar Magnetic Field Evolution",
         "Huang R, Ma T", "应用PC因果发现算法分析太阳磁场参数间的因果关系...",
         "2023-07-22", "astro-ph.SR", 15),
        ("2306.09012", "10.3847/2041-8213/ace567", "Anomaly Detection in Solar Light Curves Using Autoencoders",
         "Li F, Chen G", "利用变分自编码器对TESS和GOES光变曲线进行异常检测...",
         "2023-06-30", "astro-ph.IM", 25),
    ]

    for arxiv_id, doi, title, authors, abstract, date, category, citations in papers:
        cursor.execute(
            """INSERT INTO literature
               (arxiv_id, doi, title, authors, abstract, published_date, category, citations, is_preloaded)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)""",
            (arxiv_id, doi, title, authors, abstract, date, category, citations),
        )

    conn.commit()
    conn.close()
    print(f"[OK] 文献数据: {len(papers)}篇预加载论文")


def init_fts_index():
    """重建全文检索索引"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute("DELETE FROM literature_fts")
        cursor.execute("""
            INSERT INTO literature_fts (rowid, title, abstract, authors)
            SELECT id, title, abstract, authors FROM literature
        """)
        conn.commit()
        print("[OK] FTS5全文索引已重建")
    except Exception as e:
        print(f"[WARN] FTS索引重建失败: {e}")

    conn.close()


def main():
    print("=" * 60)
    print("  Academic Joan of Arc — 数据库初始化")
    print("=" * 60)
    print()

    init_schema()
    init_users()
    init_knowledge_graph()
    init_astro_data()
    init_literature()
    init_fts_index()

    print()
    print("=" * 60)
    print("  初始化完成！")
    print(f"  数据库路径: {DB_PATH}")
    print("  默认账号: admin / admin123")
    print("=" * 60)


if __name__ == "__main__":
    main()
