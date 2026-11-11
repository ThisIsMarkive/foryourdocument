/**
 * patchHwpx 문단 → 표 인플레이스 변환 (v3.5).
 *
 * parse() 마크다운의 한 문단을 GFM 표로 편집해 patchHwpx에 넘기면, 원본 <hp:p>가
 * 그 자리에서 표로 치환되고 셀 테두리 borderFill이 header.xml에 1회 주입된다.
 * 나머지 문단·서식은 보존, 무손실 검증(modified/added/removed=0) 통과를 확인한다.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { markdownToHwpx, parse, patchHwpx } from "../src/index.js"

function toU8(ab: ArrayBuffer): Uint8Array { return new Uint8Array(ab) }
async function makeDoc(md: string): Promise<Uint8Array> { return toU8(await markdownToHwpx(md)) }
function tableBlocks(blocks: any[]) { return blocks.filter(b => b.type === "table") }

describe("patchHwpx: 문단 → 표 인플레이스 변환", () => {
  it("단일 문단을 GFM 표로 변환 — 무손실, 나머지 문단 보존", async () => {
    const orig = await makeDoc("# 회의 보고\n\n첫 문단 보존.\n\n표로 바뀔 문단.\n\n끝 문단 보존.")
    const parsed = await parse(orig)
    const lines = parsed.markdown.split("\n")
    const idx = lines.findIndex(l => l.includes("표로 바뀔"))
    assert.ok(idx >= 0, "대상 문단 존재")
    lines.splice(idx, 1, "| 항목 | 내용 |", "| --- | --- |", "| 일시 | 6월 23일 |", "| 장소 | 회의실 |")

    const res = await patchHwpx(orig, lines.join("\n"))
    assert.equal(res.success, true)
    assert.equal(res.applied, 1)
    assert.equal(res.skipped.length, 0, "skip 없음")
    assert.equal(res.verification?.stats.modified, 0, "무손실 — 잔차 없음")
    assert.equal(res.verification?.stats.added, 0)
    assert.equal(res.verification?.stats.removed, 0)

    const re = await parse(res.data!)
    const tbls = tableBlocks(re.blocks)
    assert.equal(tbls.length, 1, "표 1개 생성")
    assert.equal(tbls[0].table.rows, 3)
    assert.equal(tbls[0].table.cols, 2)
    assert.equal(tbls[0].table.cells[0][0].text, "항목")
    assert.equal(tbls[0].table.cells[1][1].text, "6월 23일")
    assert.ok(re.markdown.includes("첫 문단 보존"), "앞 문단 보존")
    assert.ok(re.markdown.includes("끝 문단 보존"), "뒤 문단 보존")
  })

  it("여러 문단을 각각 다른 표로 변환 (borderFill 1회 주입 공유)", async () => {
    const orig = await makeDoc("# 보고서\n\n가 문단.\n\n나 문단.\n\n다 문단.")
    const parsed = await parse(orig)
    const lines = parsed.markdown.split("\n")
    const ia = lines.findIndex(l => l.includes("가 문단"))
    lines.splice(ia, 1, "| A | B |", "| --- | --- |", "| 1 | 2 |")
    const ib = lines.findIndex(l => l.includes("나 문단"))
    lines.splice(ib, 1, "| C | D |", "| --- | --- |", "| 3 | 4 |")

    const res = await patchHwpx(orig, lines.join("\n"))
    assert.equal(res.success, true)
    assert.equal(res.applied, 2)
    assert.equal(res.verification?.stats.modified, 0)
    const re = await parse(res.data!)
    assert.equal(tableBlocks(re.blocks).length, 2, "표 2개")
    assert.ok(re.markdown.includes("다 문단"), "변환 안 한 문단 보존")
  })

  it("표 변환 + 다른 문단 텍스트 수정 동시 적용", async () => {
    const orig = await makeDoc("# 제목\n\n수정될 문단.\n\n표로 바뀔 문단.\n\n끝.")
    const parsed = await parse(orig)
    let edited = parsed.markdown.replace("수정될 문단.", "수정 완료된 문단.")
    const lines = edited.split("\n")
    const idx = lines.findIndex(l => l.includes("표로 바뀔"))
    lines.splice(idx, 1, "| 키 | 값 |", "| --- | --- |", "| 이름 | 홍길동 |")

    const res = await patchHwpx(orig, lines.join("\n"))
    assert.equal(res.success, true)
    assert.equal(res.applied, 2, "텍스트 수정 + 표 변환")
    const re = await parse(res.data!)
    assert.equal(tableBlocks(re.blocks).length, 1)
    assert.ok(re.markdown.includes("수정 완료된 문단"), "텍스트 수정 반영")
  })

  it("표 셀의 특수문자(<, &, 파이프) 안전 이스케이프", async () => {
    const orig = await makeDoc("문단 변환 대상.")
    const parsed = await parse(orig)
    const lines = parsed.markdown.split("\n")
    const idx = lines.findIndex(l => l.includes("문단 변환 대상"))
    lines.splice(idx, 1, "| 조건 | 비고 |", "| --- | --- |", "| a \\< b & c | 통과 |")

    const res = await patchHwpx(orig, lines.join("\n"))
    assert.equal(res.success, true)
    assert.equal(res.applied, 1)
    const re = await parse(res.data!)
    const tbls = tableBlocks(re.blocks)
    assert.equal(tbls.length, 1)
    assert.ok(tbls[0].table.cells[1][0].text.includes("&"), "& 보존")
    assert.ok(tbls[0].table.cells[1][0].text.includes("<"), "< 보존")
  })
})
