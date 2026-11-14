"""
高管機密專櫃評估與續約決策報告 - AES-256 加密 PDF 產生器
支援 LINE 傳送、手機原生閱讀器免解壓直接輸入密碼開啟
"""
import sys
import json
import os
import pymupdf

def generate_encrypted_pdf(dossier_data, advisory_data, output_path, password=None):
    if not password:
        password = os.environ.get('DEFAULT_REPORT_PASSWORD', '')
    doc = pymupdf.open()
    # A4 尺寸: 595 x 842 pt
    page = doc.new_page(width=595, height=842)
    
    # 載入 Windows 內建微軟正黑體
    font_regular = "C:/Windows/Fonts/msjh.ttc"
    font_bold = "C:/Windows/Fonts/msjhbd.ttc"
    if not os.path.exists(font_bold):
        font_bold = font_regular

    page.insert_font(fontname="MSJH", fontfile=font_regular)
    page.insert_font(fontname="MSJH-Bold", fontfile=font_bold)

    meta = dossier_data.get('meta', {})
    financials = dossier_data.get('financials', {})
    records = financials.get('monthlyRecords', [])

    # 1. 頂部深藍標題區塊 (比照手機 HTML 檔頭置中層次排版)
    page.draw_rect(pymupdf.Rect(0, 0, 595, 90), color=None, fill=(0.06, 0.16, 0.38)) # #0f2960
    
    counter_id = meta.get('counterId', '')
    counter_name = meta.get('counterName', '')
    floor = meta.get('floor', '') or '未標註'
    industry = meta.get('industry', '') or '一般專櫃'
    store_area = meta.get('storeArea', '') or '15 坪'
    versions = "、".join(meta.get('selectedVersions', []))
    period = f"{meta.get('startDate', '')} ~ {meta.get('endDate', '')}"

    # 小膠囊標籤
    badge_text = "高管機密決策簡報"
    badge_rect = pymupdf.Rect(245, 10, 350, 26)
    page.draw_rect(badge_rect, color=None, fill=(0.12, 0.23, 0.54)) # #1e3a8a
    page.insert_text((253, 22), badge_text, fontname="MSJH-Bold", fontsize=9.5, color=(1, 1, 1))

    # 大標題：[專櫃編號] 專櫃名稱
    title_text = f"[{counter_id}] {counter_name}"
    title_w = len(title_text) * 11
    title_x = max(36, (595 - title_w) / 2)
    page.insert_text((title_x, 48), title_text, fontname="MSJH-Bold", fontsize=16, color=(1, 1, 1))

    # 副標題第 1 行：所屬樓層 ｜ 業種 ｜ 面積
    sub1_text = f"所屬樓層：{floor}  ｜  業種：{industry}  ｜  面積：{store_area}"
    sub1_w = len(sub1_text) * 5.8
    sub1_x = max(36, (595 - sub1_w) / 2)
    page.insert_text((sub1_x, 66), sub1_text, fontname="MSJH", fontsize=9.5, color=(0.75, 0.85, 1))

    # 副標題第 2 行：評估期別
    sub2_text = f"評估期別：第 {versions} 期 ({period})"
    sub2_w = len(sub2_text) * 5.5
    sub2_x = max(36, (595 - sub2_w) / 2)
    page.insert_text((sub2_x, 81), sub2_text, fontname="MSJH-Bold", fontsize=9.5, color=(0.5, 0.8, 1))

    # 2. 核心續約決策卡
    renewal_action = advisory_data.get('renewalAction', '')
    current_rate = advisory_data.get('currentBaseRate', advisory_data.get('currentRate', '15%'))
    rec_rate = advisory_data.get('recommendedBaseRate', advisory_data.get('recRate', '15%'))
    rate_delta = advisory_data.get('rateChangeDelta', advisory_data.get('rateChange', '0%'))
    rec_base_rent = advisory_data.get('recommendedBaseRent', advisory_data.get('recBaseRent', 'NT$ 0 / 月'))
    strategy = advisory_data.get('commissionStrategy', advisory_data.get('strategy', ''))

    page.draw_rect(pymupdf.Rect(36, 96, 559, 178), color=(0.85, 0.9, 0.98), fill=(0.95, 0.97, 1))
    page.insert_text((50, 114), "🎯 招商決策建議結論", fontname="MSJH-Bold", fontsize=10, color=(0.08, 0.25, 0.65))
    page.insert_text((50, 133), renewal_action, fontname="MSJH-Bold", fontsize=13, color=(0.8, 0.1, 0.1))
    
    rate_text = f"抽成調整建議：{current_rate} ➔ {rec_rate} ({rate_delta})       建議月包底金額：{rec_base_rent}"
    page.insert_text((50, 151), rate_text, fontname="MSJH-Bold", fontsize=10, color=(0.1, 0.15, 0.3))
    
    strat_text = f"抽成策略模式：{strategy}"
    page.insert_text((50, 169), strat_text, fontname="MSJH", fontsize=9, color=(0.2, 0.25, 0.35))

    # 3. 談判作戰要點
    page.insert_text((36, 196), "💼 招商同仁談判作戰籌碼 (Talking Points)", fontname="MSJH-Bold", fontsize=10.5, color=(0.1, 0.2, 0.4))
    points = advisory_data.get('negotiationPoints', advisory_data.get('points', []))
    y = 212
    for p in points[:3]:
        clean_p = p.lstrip("•- \t")
        page.insert_text((46, y), f"• {clean_p}", fontname="MSJH", fontsize=8.5, color=(0.15, 0.2, 0.25))
        y += 14

    # 4. 期間營運財務精算摘要
    total_sales = financials.get('totalSales', dossier_data.get('totalSales', 0))
    total_comm = financials.get('totalCommission', dossier_data.get('totalComm', 0))
    total_deduct = financials.get('totalDeductions', dossier_data.get('totalDeduct', 0))
    shortfall_count = financials.get('shortfallCount', len([r for r in records if r.get('baseRentShortfall', 0) > 0]))

    page.draw_rect(pymupdf.Rect(36, y + 2, 559, y + 40), color=(0.9, 0.92, 0.95), fill=(0.97, 0.98, 0.99))
    stat_text_1 = f"累計未稅銷貨：NT$ {total_sales:,.0f}    累計含稅抽成：NT$ {total_comm:,.0f}    合約實扣總額：NT$ {total_deduct:,.0f}"
    sf_label = f"未達標共 {shortfall_count} 次" if shortfall_count > 0 else "全數達標 (0次)"
    stat_text_2 = f"包底檢核狀態：{sf_label}        評估月份數：{len(records)} 個月        歷史月均實扣：{advisory_data.get('avgMonthlyDeduct', 'NT$ 0')}"
    
    page.insert_text((48, y + 17), stat_text_1, fontname="MSJH-Bold", fontsize=9, color=(0.08, 0.2, 0.4))
    page.insert_text((48, y + 32), stat_text_2, fontname="MSJH", fontsize=8.5, color=(0.25, 0.3, 0.35))
    y += 48

    # 5. 近 12 個月收支與包底檢核明細表格
    page.insert_text((36, y + 8), "📅 近 12 個月收支與包底檢核清單 (營業額、抽成額、實扣款項、包底條件識別)", fontname="MSJH-Bold", fontsize=10, color=(0.1, 0.2, 0.4))
    y += 15

    # 表格標題列
    tbl_headers = ["月份", "銷售淨額 (未/含稅)", "抽成額 (未/含稅)", "實扣款項", "包底條件檢核備註"]
    col_x = [36, 95, 220, 345, 435, 559]
    page.draw_rect(pymupdf.Rect(col_x[0], y, col_x[-1], y + 16), color=None, fill=(0.15, 0.28, 0.55))
    for i, h in enumerate(tbl_headers):
        page.insert_text((col_x[i] + 4, y + 12), h, fontname="MSJH-Bold", fontsize=8, color=(1, 1, 1))
    y += 16

    # 資料行 (每行 18 pt，緊湊排版完美容納)
    recent_records = records[-12:]
    for idx, r in enumerate(recent_records):
        bg_color = (0.96, 0.98, 1) if idx % 2 == 1 else (1, 1, 1)
        page.draw_rect(pymupdf.Rect(col_x[0], y, col_x[-1], y + 18), color=(0.9, 0.9, 0.9), fill=bg_color)

        m_str = str(r.get('month', ''))
        s_un = float(r.get('sales_untaxed', r.get('sales', 0)))
        s_tot = float(r.get('sales_total', s_un))
        c_un = float(r.get('comm_untaxed', r.get('commission', 0)))
        c_tot = float(r.get('comm_total', r.get('commission', 0)))
        deduct = float(r.get('deductions', r.get('deduct', 0)))
        sf = float(r.get('baseRentShortfall', 0))

        # 月份
        page.insert_text((col_x[0] + 4, y + 12), m_str, fontname="MSJH-Bold", fontsize=8, color=(0.1, 0.1, 0.1))
        # 銷售
        page.insert_text((col_x[1] + 4, y + 8), f"NT$ {s_un:,.0f}", fontname="MSJH-Bold", fontsize=7.5, color=(0.05, 0.45, 0.25))
        page.insert_text((col_x[1] + 4, y + 15), f"含稅 {s_tot:,.0f}", fontname="MSJH", fontsize=6.8, color=(0.4, 0.45, 0.5))
        # 抽成
        page.insert_text((col_x[2] + 4, y + 8), f"NT$ {c_un:,.0f}", fontname="MSJH-Bold", fontsize=7.5, color=(0.7, 0.35, 0.05))
        page.insert_text((col_x[2] + 4, y + 15), f"含稅 {c_tot:,.0f}", fontname="MSJH", fontsize=6.8, color=(0.4, 0.45, 0.5))
        # 實扣
        page.insert_text((col_x[3] + 4, y + 12), f"NT$ {deduct:,.0f}", fontname="MSJH", fontsize=7.5, color=(0.15, 0.25, 0.5))
        # 包底備註
        if sf > 0:
            page.insert_text((col_x[4] + 4, y + 8), "🔴 未達包底", fontname="MSJH-Bold", fontsize=7.5, color=(0.85, 0.15, 0.15))
            page.insert_text((col_x[4] + 4, y + 15), f"補足差額 NT$ {sf:,.0f}", fontname="MSJH-Bold", fontsize=6.8, color=(0.85, 0.15, 0.15))
        else:
            page.insert_text((col_x[4] + 4, y + 12), "🟢 達標 (無不足額)", fontname="MSJH", fontsize=7.5, color=(0.05, 0.55, 0.2))

        y += 18

    # 6. 最後一份合約扣款設定明細 (比照手機 HTML 檔尾三欄表格排版)
    terms = dossier_data.get('terms', {})
    latest_deductions = terms.get('latestDeductions', [])
    latest_month = terms.get('latestContractMonth', '最新期別')
    latest_total = terms.get('latestDeductionTotal', 0)

    if latest_deductions:
        y += 8
        header_text = f"📌 最後一份合約扣款設定明細 (基準月份：{latest_month}，合計：NT$ {latest_total:,.0f})"
        page.insert_text((36, y + 10), header_text, fontname="MSJH-Bold", fontsize=9.5, color=(0.1, 0.2, 0.4))
        y += 16

        # 表格標題列 (比照 HTML 檔尾三欄: 扣款項目名稱 ｜ 約定/月均金額 ｜ 性質與計算備註)
        tbl2_headers = ["扣款項目名稱", "約定/月均金額", "性質與計算備註"]
        tbl2_x = [36, 175, 275, 559]
        page.draw_rect(pymupdf.Rect(tbl2_x[0], y, tbl2_x[-1], y + 16), color=None, fill=(0.15, 0.28, 0.55))
        for i, h in enumerate(tbl2_headers):
            page.insert_text((tbl2_x[i] + 4, y + 12), h, fontname="MSJH-Bold", fontsize=8.5, color=(1, 1, 1))
        y += 16

        for idx, item in enumerate(latest_deductions):
            # 若高度超出頁面，自動開立第 2 頁繼續繪製
            if y + 16 > 805:
                # 頁尾
                page.insert_text((36, 825), f"Minerva-ETL 系統自動產生 ｜ 機密文件請勿外流 ｜ 產生時間：{dossier_data.get('meta', {}).get('generatedAt', '2026-11-11')}", fontname="MSJH", fontsize=8, color=(0.55, 0.6, 0.65))
                page = doc.new_page(width=595, height=842)
                page.insert_font(fontname="MSJH", fontfile=font_regular)
                page.insert_font(fontname="MSJH-Bold", fontfile=font_bold)
                y = 36
                # 續頁標題
                page.draw_rect(pymupdf.Rect(tbl2_x[0], y, tbl2_x[-1], y + 16), color=None, fill=(0.15, 0.28, 0.55))
                for i, h in enumerate(tbl2_headers):
                    page.insert_text((tbl2_x[i] + 4, y + 12), h, fontname="MSJH-Bold", fontsize=8.5, color=(1, 1, 1))
                y += 16

            name = item.get('name', '')
            amt = float(item.get('amount', 0))
            note = item.get('note', '') or '最後合約約定設定'

            bg_color = (0.96, 0.98, 1) if idx % 2 == 1 else (1, 1, 1)
            page.draw_rect(pymupdf.Rect(tbl2_x[0], y, tbl2_x[-1], y + 16), color=(0.9, 0.9, 0.9), fill=bg_color)

            # 項目名稱
            page.insert_text((tbl2_x[0] + 4, y + 11), name, fontname="MSJH-Bold", fontsize=8, color=(0.15, 0.2, 0.25))
            # 約定/月均金額
            page.insert_text((tbl2_x[1] + 4, y + 11), f"NT$ {amt:,.0f}", fontname="MSJH-Bold", fontsize=8, color=(0.1, 0.35, 0.8))
            # 性質與計算備註
            page.insert_text((tbl2_x[2] + 4, y + 11), note, fontname="MSJH", fontsize=7.5, color=(0.3, 0.35, 0.4))

            y += 16

    # 頁尾資安備註 (固定於底端)
    page.insert_text((36, 825), f"Minerva-ETL 系統自動產生 ｜ 機密文件請勿外流 ｜ 產生時間：{dossier_data.get('meta', {}).get('generatedAt', '2026-11-11')}", fontname="MSJH", fontsize=8, color=(0.55, 0.6, 0.65))

    # 字型子集化（精簡嵌入字型，檔案大小自 35MB 降至數十 KB）
    try:
        doc.subset_fonts()
    except Exception:
        pass

    # 同時儲存未加密之乾淨範本，供前端純本機動態自訂密碼即時封裝
    raw_output_path = output_path.replace(".pdf", "_raw.pdf")
    doc.save(raw_output_path, encryption=pymupdf.PDF_ENCRYPT_NONE, deflate=True, garbage=4)

    # 銀行級 AES-256 加密保存
    doc.save(
        output_path,
        encryption=pymupdf.PDF_ENCRYPT_AES_256,
        user_pw=password,
        owner_pw=password,
        deflate=True,
        garbage=4
    )
    doc.close()
    return output_path

if __name__ == "__main__":
    if len(sys.argv) > 2:
        dossier_json_path = sys.argv[1]
        out_pdf_path = sys.argv[2]
        pwd = sys.argv[3] if len(sys.argv) > 3 else os.environ.get('DEFAULT_REPORT_PASSWORD', '')
        with open(dossier_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        generate_encrypted_pdf(data['dossier'], data['advisory'], out_pdf_path, pwd)
        print(f"Encrypted PDF successfully generated at: {out_pdf_path}")
