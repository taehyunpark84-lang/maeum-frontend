from app.art_direction import AXES, choose_direction


def test_visual_axes_avoid_recent_choices_independently():
    previous = '\n'.join(options[0] for options in AXES.values())
    for _ in range(20):
        direction = choose_direction([previous])
        for axis, options in AXES.items():
            line = next(line for line in direction.splitlines() if line.startswith(axis + ':'))
            assert line.removeprefix(axis + ': ') in options[1:]


def test_visual_axes_still_work_when_all_options_were_used():
    previous = '\n'.join(option for options in AXES.values() for option in options)
    assert len(choose_direction([previous]).splitlines()) == len(AXES)
